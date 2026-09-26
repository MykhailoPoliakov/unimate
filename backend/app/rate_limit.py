from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User

POST_COOLDOWN = timedelta(minutes=5)


def enforce_create_cooldown(db: Session, user: User, model) -> None:
    if user.role == "admin":
        return
    latest = db.scalar(select(func.max(model.created_at)).where(model.author_id == user.id))
    if latest is None:
        return
    if latest.tzinfo is None:
        latest = latest.replace(tzinfo=timezone.utc)
    remaining = POST_COOLDOWN - (datetime.now(timezone.utc) - latest)
    if remaining <= timedelta(0):
        return
    seconds = max(int(remaining.total_seconds()) + 1, 1)
    raise HTTPException(429, {"code": "cooldown", "retry_after": seconds})
