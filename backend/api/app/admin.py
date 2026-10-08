import argparse
import sys
import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import SessionLocal
from app.models import Program, User


def parse_user_id(raw: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw.strip())
    except ValueError as error:
        raise SystemExit(f"Invalid user id: {raw}") from error


def find_user(db, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise SystemExit(f"User not found: {user_id}")
    return user


def show(user: User) -> None:
    institution = user.program.institution.slug if user.program else "?"
    program = user.program.slug if user.program else "?"
    print(f"{user.id}  {user.role}  {institution}/{program}")


def grant(user_id: str) -> None:
    with SessionLocal() as db:
        user = find_user(db, parse_user_id(user_id))
        user.role = "admin"
        db.commit()
        db.refresh(user)
        user = db.scalar(
            select(User)
            .options(selectinload(User.program).selectinload(Program.institution))
            .where(User.id == user.id)
        )
        show(user)


def revoke(user_id: str) -> None:
    with SessionLocal() as db:
        user = find_user(db, parse_user_id(user_id))
        user.role = "student"
        db.commit()
        db.refresh(user)
        user = db.scalar(
            select(User)
            .options(selectinload(User.program).selectinload(Program.institution))
            .where(User.id == user.id)
        )
        show(user)


def list_users() -> None:
    with SessionLocal() as db:
        users = db.scalars(
            select(User).options(selectinload(User.program).selectinload(Program.institution))
        ).all()
        if not users:
            print("No users.")
            return
        for user in users:
            show(user)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Grant or revoke UniMate admin.")
    sub = parser.add_subparsers(dest="command", required=True)

    grant_parser = sub.add_parser("grant", help="Set role to admin")
    grant_parser.add_argument("user_id")

    revoke_parser = sub.add_parser("revoke", help="Set role to student")
    revoke_parser.add_argument("user_id")

    sub.add_parser("list", help="List users and roles")

    args = parser.parse_args(argv)
    if args.command == "grant":
        grant(args.user_id)
    elif args.command == "revoke":
        revoke(args.user_id)
    else:
        list_users()


if __name__ == "__main__":
    main(sys.argv[1:])
