import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import HomeButtonConfig, User
from app.schemas import HomeButtonsOut, HomeButtonsUpdate

router = APIRouter(prefix="/home-buttons", tags=["home-buttons"])


@router.get("", response_model=HomeButtonsOut)
def get_home_buttons(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.get(HomeButtonConfig, user.program.institution_id)
    if config is None:
        return HomeButtonsOut(configured=False)
    return HomeButtonsOut(configured=True, buttons=json.loads(config.buttons_json))


@router.put("", response_model=HomeButtonsOut)
def update_home_buttons(
    data: HomeButtonsUpdate,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user.program.institution.slug != "kdg" and any(
        button.platform == "schedule" for button in data.buttons
    ):
        raise HTTPException(422, "The special Schedule button is only supported for KdG")

    config = db.get(HomeButtonConfig, user.program.institution_id)
    if config is None:
        config = HomeButtonConfig(
            institution_id=user.program.institution_id,
            buttons_json="[]",
        )
        db.add(config)
    config.buttons_json = json.dumps(
        [button.model_dump(mode="json") for button in data.buttons],
        ensure_ascii=False,
    )
    db.commit()
    return HomeButtonsOut(configured=True, buttons=data.buttons)
