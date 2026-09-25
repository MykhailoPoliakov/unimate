from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Institution
from app.schemas import InstitutionOut, ProgramOut

router = APIRouter(prefix="/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionOut])
def list_institutions(db: Session = Depends(get_db)):
    return db.scalars(
        select(Institution).options(selectinload(Institution.programs)).order_by(Institution.name)
    ).all()


@router.get("/{slug}/programs", response_model=list[ProgramOut])
def list_programs(slug: str, db: Session = Depends(get_db)):
    institution = db.scalar(select(Institution).where(Institution.slug == slug))
    if institution is None:
        raise HTTPException(404, "Institution not found")
    return institution.programs