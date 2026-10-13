import uuid
from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.academic import enrollment_year_for, year_of_study
from app.audience import moderator_scope, serialize_moderator_scope
from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import Button, Institution, News, NewsVote, Program, PushToken, Social, User
from app.schemas import Language, UserCreate, UserOut, UserRoleUpdate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def find_program(db: Session, institution_slug: str, program_slug: str) -> Program | None:
    return db.scalar(
        select(Program)
        .join(Institution)
        .where(Institution.slug == institution_slug, Program.slug == program_slug)
    )


def to_out(user: User) -> UserOut:
    scope = moderator_scope(user) if user.role == "moderator" else {"institutions": [], "programs": [], "years": []}
    return UserOut(
        id=user.id,
        institution=user.program.institution.slug,
        program=user.program.slug,
        year_of_study=year_of_study(user.enrollment_year),
        language=cast(Language, user.language),
        role=cast(Literal["student", "moderator", "admin"], user.role),
        moderator_institutions=scope["institutions"],
        moderator_programs=scope["programs"],
        moderator_years=scope["years"],
    )


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    program = find_program(db, data.institution, data.program)
    if program is None:
        raise HTTPException(404, "Unknown institution or program")
    if data.year_of_study > program.duration_years:
        raise HTTPException(422, "Year of study exceeds program length")

    user = User(
        program_id=program.id,
        language=data.language,
        enrollment_year=enrollment_year_for(data.year_of_study),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return to_out(user)


@router.get("/{user_id}", response_model=UserOut)
def read_user(user_id: uuid.UUID, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    return to_out(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")

    program = user.program
    changed_study = False

    if data.institution is not None or data.program is not None:
        program = find_program(
            db,
            data.institution or user.program.institution.slug,
            data.program or user.program.slug,
        )
        if program is None:
            raise HTTPException(404, "Unknown institution or program")
        user.program_id = program.id
        changed_study = True

    if data.year_of_study is not None:
        user.enrollment_year = enrollment_year_for(data.year_of_study)
        changed_study = True

    if changed_study and year_of_study(user.enrollment_year) > program.duration_years:
        raise HTTPException(422, "Year of study exceeds program length")

    if data.language is not None:
        user.language = data.language

    db.commit()
    db.refresh(user)
    return to_out(user)


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: uuid.UUID,
    data: UserRoleUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")

    if user.role == "admin" and data.role != "admin":
        admin_count = db.scalar(
            select(func.count()).select_from(User).where(User.role == "admin")
        )
        if admin_count <= 1:
            raise HTTPException(409, "Cannot remove the last admin")

    user.role = data.role
    if data.role == "moderator":
        institutions = [slug for slug in data.institutions if slug] or [user.program.institution.slug]
        programs = [slug for slug in data.programs if slug] or [user.program.slug]
        found_programs = db.scalars(
            select(Program).join(Institution).where(
                Institution.slug.in_(institutions),
                Program.slug.in_(programs),
            )
        ).all()
        if {row.slug for row in found_programs} != set(programs):
            raise HTTPException(404, "Unknown institution or program")
        user.moderator_scope = serialize_moderator_scope(institutions, programs, data.years)
    else:
        user.moderator_scope = None
    db.commit()
    db.refresh(user)
    return to_out(user)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.id != user_id:
        raise HTTPException(403, "You can only delete your own profile")
    if user.role == "admin":
        admin_count = db.scalar(select(func.count()).select_from(User).where(User.role == "admin"))
        if admin_count <= 1:
            raise HTTPException(409, "Cannot remove the last admin")
    db.execute(delete(NewsVote).where(NewsVote.user_id == user.id))
    db.execute(delete(PushToken).where(PushToken.user_id == user.id))
    db.execute(update(News).where(News.author_id == user.id).values(author_id=None))
    db.execute(update(Button).where(Button.author_id == user.id).values(author_id=None))
    db.execute(update(Social).where(Social.author_id == user.id).values(author_id=None))
    db.delete(user)
    db.commit()
    return Response(status_code=204)