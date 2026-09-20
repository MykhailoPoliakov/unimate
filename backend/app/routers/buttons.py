from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.content import pick_translation, visible_to
from app.db import get_db
from app.deps import get_current_user
from app.models import Button, User
from app.schemas import ButtonOut

router = APIRouter(prefix="/buttons", tags=["buttons"])


@router.get("", response_model=list[ButtonOut])
def list_buttons(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = visible_to(
        Button,
        user.program.institution_id,
        user.program_id,
        year_of_study(user.enrollment_year),
    )
    buttons = db.scalars(
        select(Button)
        .options(selectinload(Button.translations))
        .where(Button.is_active, *rules)
        .order_by(Button.sort_order, Button.id)
    ).all()

    result = []
    for b in buttons:
        t = pick_translation(b.translations, user.language)
        if t is None:
            continue
        result.append(
            ButtonOut(
                id=b.id,
                title=t.title,
                description=t.description,
                url=b.url,
                icon=b.icon,
                platform=b.platform,
            )
        )
    return result