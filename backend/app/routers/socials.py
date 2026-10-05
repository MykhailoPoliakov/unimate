from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.audience import audience_fields, constrain_moderator_audience, resolve_audience
from app.content import matches_audience, pick_translation, visible_to_institution
from app.db import get_db
from app.deps import get_current_user, require_news_manager
from app.models import Social, SocialTranslation, User
from app.rate_limit import enforce_create_cooldown
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


def _apply_audience(social: Social, db: Session, user, institution, programs, years, legacy_program=None):
    institution, programs, years, legacy_program = constrain_moderator_audience(
        user, db, institution, programs, years, legacy_program
    )
    (
        institution_id,
        program_id,
        program_slugs,
        year_list,
        year_min,
        year_max,
    ) = resolve_audience(db, institution, programs, years, legacy_program)
    social.institution_id = institution_id
    social.program_id = program_id
    social.program_slugs = program_slugs
    social.year_list = year_list
    social.year_min = year_min
    social.year_max = year_max


def _admin_out(social: Social, db: Session) -> SocialAdminOut:
    institution, programs, years = audience_fields(social, db)
    return SocialAdminOut(
        id=social.id,
        url=social.url,
        icon=social.icon,
        platform=social.platform,
        sort_order=social.sort_order,
        is_active=social.is_active,
        institution=institution,
        program=programs[0] if programs else None,
        programs=programs,
        years=years,
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
    rules = visible_to_institution(Social, user.program.institution_id)
    socials = db.scalars(
        select(Social)
        .options(selectinload(Social.translations))
        .where(Social.is_active, *rules)
        .order_by(Social.sort_order, Social.id)
    ).all()
    year = year_of_study(user.enrollment_year)

    result = []
    for social in socials:
        if not matches_audience(
            social, user.program.institution_id, user.program_id, user.program.slug, year
        ):
            continue
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


def _ensure_can_manage(social: Social, user: User) -> None:
    if user.role == "moderator" and social.author_id != user.id:
        raise HTTPException(404, "Social not found")


@router.get("/manage", response_model=list[SocialAdminOut])
def manage_socials(
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    query = (
        select(Social)
        .options(selectinload(Social.translations))
        .order_by(Social.sort_order, Social.id)
    )
    if user.role != "admin":
        query = query.where(Social.author_id == user.id)
    socials = db.scalars(query).all()
    return [_admin_out(social, db) for social in socials]


@router.post("", response_model=SocialAdminOut, status_code=201)
def create_social(
    data: SocialCreate,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    enforce_create_cooldown(db, user, Social)
    _validate_translations(data.translations)
    social = Social(
        url=data.url,
        icon=data.icon,
        platform=data.platform,
        sort_order=data.sort_order,
        is_active=data.is_active,
        created_at=datetime.now(timezone.utc),
        author_id=user.id,
        translations=[
            SocialTranslation(
                lang=item.lang,
                title=item.title,
                description=item.description,
            )
            for item in data.translations
        ],
    )
    _apply_audience(social, db, user, data.institution, data.programs, data.years, data.program)
    db.add(social)
    db.commit()
    return _admin_out(_get_social(db, social.id), db)


@router.patch("/{social_id}", response_model=SocialAdminOut)
def update_social(
    social_id: int,
    data: SocialUpdate,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    social = db.get(Social, social_id)
    if social is None:
        raise HTTPException(404, "Social not found")
    _ensure_can_manage(social, user)

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

    if any(field in changes for field in ("institution", "program", "programs", "years")):
        _apply_audience(
            social,
            db,
            user,
            data.institution,
            data.programs or ([data.program] if data.program else []),
            data.years,
            data.program,
        )

    for field in ("url", "icon", "platform", "sort_order", "is_active"):
        if field in changes:
            setattr(social, field, changes[field])

    db.commit()
    return _admin_out(_get_social(db, social.id), db)


@router.delete("/{social_id}", status_code=204)
def delete_social(
    social_id: int,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    social = db.get(Social, social_id)
    if social is None:
        raise HTTPException(404, "Social not found")
    _ensure_can_manage(social, user)
    db.delete(social)
    db.commit()


def _get_social(db: Session, social_id: int) -> Social:
    social = db.scalar(
        select(Social)
        .options(selectinload(Social.translations))
        .where(Social.id == social_id)
    )
    if social is None:
        raise HTTPException(404, "Social not found")
    return social
