from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.audience import moderator_scope
from app.content import parse_json_list
from app.db import get_db
from app.deps import require_admin
from app.models import Button, Institution, News, Program, Social, User
from app.schemas import InstitutionCreate, InstitutionOut, NameUpdate, ProgramCreate, ProgramOut

router = APIRouter(prefix="/institutions", tags=["institutions"])


def _program_delete_conflict(db: Session, program: Program) -> str | None:
    if db.scalar(select(func.count()).select_from(User).where(User.program_id == program.id)):
        return "Move users to another program before deleting this program"

    for model in (Button, News, Social):
        if db.scalar(
            select(func.count()).select_from(model).where(model.program_id == program.id)
        ):
            return "Move or remove content targeting this program first"
        audience_rows = db.scalars(
            select(model).where(model.institution_id == program.institution_id)
        ).all()
        if any(program.slug in parse_json_list(row.program_slugs) for row in audience_rows):
            return "Move or remove content targeting this program first"

    scope_users = db.scalars(
        select(User).where(User.role == "moderator", User.moderator_scope.is_not(None))
    ).all()
    for user in scope_users:
        scope = moderator_scope(user)
        if program.slug in scope["programs"] and program.institution.slug in scope["institutions"]:
            return "Remove this program from moderator scopes first"
    return None


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


@router.post("", response_model=InstitutionOut, status_code=201)
def create_institution(
    data: InstitutionCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.scalar(select(Institution.id).where(Institution.slug == data.slug)) is not None:
        raise HTTPException(409, "A university with this slug already exists")
    institution = Institution(slug=data.slug, name=data.name)
    db.add(institution)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "A university with this slug already exists") from error
    db.refresh(institution)
    return institution


@router.delete("/{slug}", status_code=204)
def delete_institution(
    slug: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    institution = db.scalar(select(Institution).where(Institution.slug == slug))
    if institution is None:
        raise HTTPException(404, "University not found")
    programs = db.scalars(
        select(Program).where(Program.institution_id == institution.id)
    ).all()
    for program in programs:
        conflict = _program_delete_conflict(db, program)
        if conflict:
            raise HTTPException(409, conflict)

    for model in (Button, News, Social):
        if db.scalar(
            select(func.count()).select_from(model).where(model.institution_id == institution.id)
        ):
            raise HTTPException(409, "Move or remove content targeting this university first")
    moderators = db.scalars(
        select(User).where(User.role == "moderator", User.moderator_scope.is_not(None))
    ).all()
    if any(institution.slug in moderator_scope(user)["institutions"] for user in moderators):
        raise HTTPException(409, "Remove this university from moderator scopes first")

    for program in programs:
        db.delete(program)
    db.flush()
    db.delete(institution)
    db.commit()
    return Response(status_code=204)


@router.post("/{slug}/programs", response_model=ProgramOut, status_code=201)
def create_program(
    slug: str,
    data: ProgramCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    institution = db.scalar(select(Institution).where(Institution.slug == slug))
    if institution is None:
        raise HTTPException(404, "University not found")
    if db.scalar(
        select(Program.id).where(
            Program.institution_id == institution.id,
            Program.slug == data.slug,
        )
    ) is not None:
        raise HTTPException(409, "A program with this slug already exists at this university")

    program = Program(institution_id=institution.id, **data.model_dump())
    db.add(program)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "A program with this slug already exists at this university") from error
    db.refresh(program)
    return program


@router.patch("/{slug}", response_model=InstitutionOut)
def update_institution(
    slug: str,
    data: NameUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    institution = db.scalar(
        select(Institution).options(selectinload(Institution.programs)).where(Institution.slug == slug)
    )
    if institution is None:
        raise HTTPException(404, "University not found")
    institution.name = data.name
    db.commit()
    db.refresh(institution)
    return institution


@router.patch("/{slug}/programs/{program_slug}", response_model=ProgramOut)
def update_program(
    slug: str,
    program_slug: str,
    data: NameUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    program = db.scalar(
        select(Program)
        .join(Institution)
        .where(Institution.slug == slug, Program.slug == program_slug)
    )
    if program is None:
        raise HTTPException(404, "Program not found")
    program.name = data.name
    db.commit()
    db.refresh(program)
    return program


@router.delete("/{slug}/programs/{program_slug}", status_code=204)
def delete_program(
    slug: str,
    program_slug: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    program = db.scalar(
        select(Program)
        .join(Institution)
        .where(Institution.slug == slug, Program.slug == program_slug)
    )
    if program is None:
        raise HTTPException(404, "Program not found")
    conflict = _program_delete_conflict(db, program)
    if conflict:
        raise HTTPException(409, conflict)

    db.delete(program)
    db.commit()
    return Response(status_code=204)