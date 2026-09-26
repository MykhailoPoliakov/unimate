import uuid

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User


def get_current_user(
    x_user_id: uuid.UUID = Header(),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, x_user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def require_news_manager(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"admin", "moderator"}:
        raise HTTPException(403, "News manager access required")
    return user