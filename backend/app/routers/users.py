import uuid
from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.academic import enrollment_year_for, year_of_study
from app.db import get_db
from app.models import Institution, Program, User
from app.schemas import Language, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def find_program(db: Session, institution_slug: str, program_slug: str) -> Program | None:
    return db.scalar(
        select(Program)
        .join(Institution)
        .where(Institution.slug == institution_slug, Program.slug == program_slug)
    )


def to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        institution=user.program.institution.slug,
        program=user.program.slug,
        year_of_study=year_of_study(user.enrollment_year),
        language=cast(Language, user.language),
        role=cast(Literal["student", "admin"], user.role),
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