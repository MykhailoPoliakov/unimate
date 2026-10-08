from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import PushToken, User
from app.schemas import PushDeviceUpdate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.put("/device", status_code=204)
def update_push_device(
    data: PushDeviceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = db.get(PushToken, data.token)
    if device is None:
        device = PushToken(
            token=data.token,
            user_id=user.id,
            enabled=data.enabled,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(device)
    else:
        device.user_id = user.id
        device.enabled = data.enabled
        device.updated_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=204)