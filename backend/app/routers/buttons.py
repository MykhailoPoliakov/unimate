from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.audience import audience_fields, constrain_moderator_audience, resolve_audience
from app.content import matches_audience, pick_translation, visible_to_institution
from app.db import get_db
from app.deps import get_current_user, require_news_manager
from app.favicon import preview_website
from app.models import Button, ButtonTranslation, User
from app.rate_limit import enforce_create_cooldown
from app.schemas import (
    ButtonAdminOut,
    ButtonCreate,
    ButtonOut,
    ButtonPreviewIn,
    ButtonPreviewOut,
    ButtonReorderIn,
    ButtonTranslationAdminOut,
    ButtonUpdate,
    Language,
)

router = APIRouter(prefix="/buttons", tags=["buttons"])


def _validate_translations(translations) -> None:
    languages = [item.lang for item in translations]
    if len(languages) != len(set(languages)):
        raise HTTPException(422, "translations must contain each language only once")


def _apply_audience(button: Button, db: Session, user, institution, programs, years, legacy_program=None):
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
    button.institution_id = institution_id
    button.program_id = program_id
    button.program_slugs = program_slugs
    button.year_list = year_list
    button.year_min = year_min
    button.year_max = year_max


def _admin_out(button: Button, db: Session) -> ButtonAdminOut:
    institution, programs, years = audience_fields(button, db)
    return ButtonAdminOut(
        id=button.id,
        url=button.url,
        icon=button.icon,
        color=button.color,
        platform=button.platform,
        sort_order=button.sort_order,
        is_active=button.is_active,
        institution=institution,
        program=programs[0] if programs else None,
        programs=programs,
        years=years,
        translations=[
            ButtonTranslationAdminOut(
                lang=cast(Language, item.lang),
                title=item.title,
                description=item.description,
            )
            for item in button.translations
        ],
    )


def _ensure_can_manage(button: Button, user: User) -> None:
    if user.role == "moderator" and button.author_id != user.id:
        raise HTTPException(404, "Not found")


def _get_button(db: Session, button_id: int) -> Button:
    button = db.scalar(
        select(Button).options(selectinload(Button.translations)).where(Button.id == button_id)
    )
    if button is None:
        raise HTTPException(404, "Not found")
    return button


@router.get("", response_model=list[ButtonOut])
def list_buttons(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = visible_to_institution(Button, user.program.institution_id)
    buttons = db.scalars(
        select(Button)
        .options(selectinload(Button.translations))
        .where(Button.is_active, *rules)
        .order_by(Button.sort_order, Button.id)
    ).all()
    year = year_of_study(user.enrollment_year)
    result = []
    for button in buttons:
        if not matches_audience(
            button, user.program.institution_id, user.program_id, user.program.slug, year
        ):
            continue
        translation = pick_translation(button.translations, user.language)
        if translation is None:
            continue
        result.append(
            ButtonOut(
                id=button.id,
                title=translation.title,
                description=translation.description,
                url=button.url,
                icon=button.icon,
                color=button.color,
                platform=button.platform,
            )
        )
    return result


@router.get("/manage", response_model=list[ButtonAdminOut])
def manage_buttons(
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    query = select(Button).options(selectinload(Button.translations)).order_by(Button.sort_order, Button.id)
    if user.role != "admin":
        query = query.where(Button.author_id == user.id)
    return [_admin_out(button, db) for button in db.scalars(query).all()]


@router.put("/reorder", status_code=204)
def reorder_buttons(
    data: ButtonReorderIn,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    ordered = [(button_id, index) for index, button_id in enumerate(data.service_ids)]
    ordered += [(button_id, 1000 + index) for index, button_id in enumerate(data.extra_ids)]
    if not ordered:
        return
    ids = [button_id for button_id, _ in ordered]
    buttons = {
        button.id: button
        for button in db.scalars(select(Button).where(Button.id.in_(ids))).all()
    }
    for button_id, sort_order in ordered:
        button = buttons.get(button_id)
        if button is None:
            raise HTTPException(404, "Not found")
        if user.role == "moderator" and button.author_id != user.id:
            continue
        button.sort_order = sort_order
    db.commit()


@router.post("/preview", response_model=ButtonPreviewOut)
def preview_button(
    data: ButtonPreviewIn,
    user: User = Depends(get_current_user),
):
    return ButtonPreviewOut(**preview_website(data.url))


@router.post("", response_model=ButtonAdminOut, status_code=201)
def create_button(
    data: ButtonCreate,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    enforce_create_cooldown(db, user, Button)
    _validate_translations(data.translations)
    sort_order = data.sort_order
    if data.platform == "custom" or sort_order == 0:
        highest = db.scalar(select(func.max(Button.sort_order))) or 0
        sort_order = max(highest + 1, 1000)
    button = Button(
        url=data.url,
        icon=data.icon,
        color=data.color,
        platform=data.platform,
        sort_order=sort_order,
        is_active=data.is_active,
        created_at=datetime.now(timezone.utc),
        author_id=user.id,
        translations=[
            ButtonTranslation(lang=item.lang, title=item.title, description=item.description)
            for item in data.translations
        ],
    )
    _apply_audience(button, db, user, data.institution, data.programs, data.years, data.program)
    db.add(button)
    db.commit()
    return _admin_out(_get_button(db, button.id), db)


@router.patch("/{button_id}", response_model=ButtonAdminOut)
def update_button(
    button_id: int,
    data: ButtonUpdate,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    button = db.get(Button, button_id)
    if button is None:
        raise HTTPException(404, "Not found")
    _ensure_can_manage(button, user)
    changes = data.model_dump(exclude_unset=True)
    if "translations" in changes:
        _validate_translations(data.translations or [])
        button.translations = [
            ButtonTranslation(lang=item.lang, title=item.title, description=item.description)
            for item in data.translations or []
        ]
    if any(field in changes for field in ("institution", "program", "programs", "years")):
        _apply_audience(
            button,
            db,
            user,
            data.institution,
            data.programs or ([data.program] if data.program else []),
            data.years,
            data.program,
        )
    for field in ("url", "icon", "color", "platform", "sort_order", "is_active"):
        if field in changes:
            setattr(button, field, changes[field])
    db.commit()
    return _admin_out(_get_button(db, button.id), db)


@router.delete("/{button_id}", status_code=204)
def delete_button(
    button_id: int,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    button = db.get(Button, button_id)
    if button is None:
        raise HTTPException(404, "Not found")
    _ensure_can_manage(button, user)
    db.delete(button)
    db.commit()
