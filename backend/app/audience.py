import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.content import parse_json_list, serialize_json_list
from app.models import Institution, Program, User


def moderator_scope(user: User) -> dict:
    parsed = {}
    if user.moderator_scope:
        try:
            loaded = json.loads(user.moderator_scope)
            parsed = loaded if isinstance(loaded, dict) else {}
        except json.JSONDecodeError:
            parsed = {}
    institutions = [str(item) for item in parsed.get("institutions") or [] if item]
    programs = [str(item) for item in parsed.get("programs") or [] if item]
    years = []
    for entry in parsed.get("years") or []:
        try:
            years.append(int(entry))
        except (TypeError, ValueError):
            continue
    if not institutions and user.program is not None:
        institutions = [user.program.institution.slug]
    if not programs and user.program is not None:
        programs = [user.program.slug]
    return {
        "institutions": institutions,
        "programs": programs,
        "years": sorted(set(years)),
    }


def serialize_moderator_scope(institutions: list[str], programs: list[str], years: list[int]) -> str | None:
    if not institutions and not programs and not years:
        return None
    return json.dumps(
        {
            "institutions": institutions,
            "programs": programs,
            "years": sorted(set(int(year) for year in years)),
        },
        ensure_ascii=False,
    )


def _program_years(db: Session, institution_slug: str, program_slugs: list[str]) -> list[int]:
    rows = db.scalars(
        select(Program)
        .join(Institution)
        .where(Institution.slug == institution_slug, Program.slug.in_(program_slugs))
    ).all()
    if not rows:
        return [1]
    return list(range(1, max(row.duration_years for row in rows) + 1))


def constrain_moderator_audience(
    user: User,
    db: Session,
    institution_slug: str | None,
    programs: list[str] | None,
    years: list[int] | None,
    legacy_program: str | None = None,
):
    slugs = [slug for slug in (programs or []) if slug]
    if not slugs and legacy_program:
        slugs = [legacy_program]
    year_values = sorted({int(year) for year in (years or [])})
    if user.role != "moderator":
        return institution_slug, slugs, year_values, None
    scope = moderator_scope(user)
    if not institution_slug:
        if len(scope["institutions"]) != 1:
            raise HTTPException(403, "Pick a university in your assignment")
        institution_slug = scope["institutions"][0]
        slugs = slugs or list(scope["programs"])
        year_values = year_values or list(scope["years"])
    if institution_slug not in scope["institutions"]:
        raise HTTPException(403, "Outside your assigned universities")
    if slugs and not set(slugs).issubset(set(scope["programs"])):
        raise HTTPException(403, "Outside your assigned fields")
    if not year_values:
        year_values = list(scope["years"]) or _program_years(db, institution_slug, slugs or scope["programs"])
    if scope["years"] and not set(year_values).issubset(set(scope["years"])):
        raise HTTPException(403, "Outside your assigned years")
    return institution_slug, slugs, year_values, None



def resolve_audience(db: Session, institution_slug: str | None, programs: list[str] | None, years: list[int] | None, legacy_program: str | None = None):
    slugs = [slug for slug in (programs or []) if slug]
    if not slugs and legacy_program:
        slugs = [legacy_program]
    year_values = sorted({int(year) for year in (years or [])})
    if not institution_slug:
        return None, None, None, None, None, None
    if not slugs or not year_values:
        raise HTTPException(422, "Select at least one field and one year")
    institution = db.scalar(select(Institution).where(Institution.slug == institution_slug))
    if institution is None:
        raise HTTPException(404, "Unknown institution or program")
    rows = db.scalars(
        select(Program).where(Program.institution_id == institution.id, Program.slug.in_(slugs))
    ).all()
    found = {row.slug for row in rows}
    if found != set(slugs):
        raise HTTPException(404, "Unknown institution or program")
    first = next(row for row in rows if row.slug == slugs[0])
    return (
        institution.id,
        first.id,
        serialize_json_list(slugs),
        serialize_json_list(year_values),
        min(year_values),
        max(year_values),
    )


def audience_fields(item, db: Session):
    institution_slug = None
    if item.institution_id:
        institution = db.get(Institution, item.institution_id)
        institution_slug = institution.slug if institution else None
    programs = [str(slug) for slug in parse_json_list(getattr(item, "program_slugs", None))]
    if not programs and item.program_id:
        program = db.get(Program, item.program_id)
        if program is not None:
            programs = [program.slug]
    years = []
    for entry in parse_json_list(getattr(item, "year_list", None)):
        try:
            years.append(int(entry))
        except (TypeError, ValueError):
            continue
    if not years and (item.year_min or item.year_max):
        start = item.year_min or item.year_max
        end = item.year_max or item.year_min
        years = list(range(start, end + 1))
    return institution_slug, programs, years
