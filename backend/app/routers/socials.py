from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.content import pick_translation, visible_to
from app.db import get_db
from app.deps import get_current_user
from app.models import Social, User
from app.schemas import SocialOut

router = APIRouter(prefix="/socials", tags=["socials"])


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
