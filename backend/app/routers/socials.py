from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.content import pick_translation, visible_to
from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import Institution, Program, Social, SocialTranslation, User
from app.schemas import (
    SocialAdminOut,
    SocialCreate,
    SocialOut,
    SocialTranslationAdminOut,
    SocialUpdate,
    Language,
)

router = APIRouter(prefix="/socials", tags=["socials"])


def _validate_translations(translations) -> None:
    languages = [item.lang for item in translations]
    if len(languages) != len(set(languages)):
        raise HTTPException(422, "translations must contain each language only once")


def _find_program(
    db: Session,
    institution_slug: str | None,
    program_slug: str | None,
) -> Program | None:
    if (institution_slug is None) != (program_slug is None):
        raise HTTPException(422, "institution and program must be provided together")
    if institution_slug is None:
        return None
    program = db.scalar(
        select(Program)
        .join(Institution)
        .where(
            Institution.slug == institution_slug,
            Program.slug == program_slug,
        )
    )
    if program is None:
        raise HTTPException(404, "Unknown institution or program")
    return program


def _validate_years(year_min: int | None, year_max: int | None) -> None:
    if year_min is not None and year_max is not None and year_min > year_max:
        raise HTTPException(422, "year_min cannot exceed year_max")


def _admin_out(social: Social) -> SocialAdminOut:
    program = None
    institution = None
    if social.program is not None:
        program = social.program.slug
        institution = social.program.institution.slug
    return SocialAdminOut(
        id=social.id,
        url=social.url,
        icon=social.icon,
        platform=social.platform,
        sort_order=social.sort_order,
        is_active=social.is_active,
        institution=institution,
        program=program,
        year_min=social.year_min,
        year_max=social.year_max,
        translations=[
            SocialTranslationAdminOut(
                lang=cast(Language, item.lang),
                title=item.title,
                description=item.description,
            )
            for item in social.translations
        ],
    )


@router.get("", response_model=list[SocialOut])
def list_socials(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = visible_to(
        Social,
        user.program.institution_id,
        user.program_id,
        year_of_study(user.enrollment_year),
    )
    socials = db.scalars(
        select(Social)
        .options(selectinload(Social.translations))
        .where(Social.is_active, *rules)
        .order_by(Social.sort_order, Social.id)
    ).all()

    result = []
    for social in socials:
        translation = pick_translation(social.translations, user.language)
        if translation is None:
            continue
        result.append(
            SocialOut(
                id=social.id,
                title=translation.title,
                description=translation.description,
                url=social.url,
                icon=social.icon,
                platform=social.platform,
            )
        )
    return result


@router.get("/manage", response_model=list[SocialAdminOut])
def manage_socials(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    socials = db.scalars(
        select(Social)
        .options(
            selectinload(Social.translations),
            selectinload(Social.program).selectinload(Program.institution),
        )
        .order_by(Social.sort_order, Social.id)
    ).all()
    return [_admin_out(social) for social in socials]


@router.post("", response_model=SocialAdminOut, status_code=201)
def create_social(
    data: SocialCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _validate_translations(data.translations)
    _validate_years(data.year_min, data.year_max)
    program = _find_program(db, data.institution, data.program)

    social = Social(
        url=data.url,
        icon=data.icon,
        platform=data.platform,
        sort_order=data.sort_order,
        is_active=data.is_active,
        institution_id=program.institution_id if program else None,
        program_id=program.id if program else None,
        year_min=data.year_min,
        year_max=data.year_max,
        translations=[
            SocialTranslation(
                lang=item.lang,
                title=item.title,
                description=item.description,
            )
            for item in data.translations
        ],
    )
    db.add(social)
    db.commit()
    return _get_social(db, social.id)


@router.patch("/{social_id}", response_model=SocialAdminOut)
def update_social(
    social_id: int,
    data: SocialUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    social = db.get(Social, social_id)
    if social is None:
        raise HTTPException(404, "Social not found")

    changes = data.model_dump(exclude_unset=True)
    if "translations" in changes:
        _validate_translations(data.translations or [])
        social.translations = [
            SocialTranslation(
                lang=item.lang,
                title=item.title,
                description=item.description,
            )
            for item in data.translations or []
        ]

    if "institution" in changes or "program" in changes:
        program = _find_program(db, data.institution, data.program)
        social.institution_id = program.institution_id if program else None
        social.program_id = program.id if program else None

    for field in ("url", "icon", "platform", "sort_order", "is_active", "year_min", "year_max"):
        if field in changes:
            setattr(social, field, changes[field])

    _validate_years(social.year_min, social.year_max)
    db.commit()
    return _get_social(db, social.id)


@router.delete("/{social_id}", status_code=204)
def delete_social(
    social_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    social = db.get(Social, social_id)
    if social is None:
        raise HTTPException(404, "Social not found")
    db.delete(social)
    db.commit()


def _get_social(db: Session, social_id: int) -> Social:
    social = db.scalar(
        select(Social)
        .options(
            selectinload(Social.translations),
            selectinload(Social.program).selectinload(Program.institution),
        )
        .where(Social.id == social_id)
    )
    if social is None:
        raise HTTPException(404, "Social not found")
    return social
