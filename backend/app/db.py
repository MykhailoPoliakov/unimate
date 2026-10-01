import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPOSITORY_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    required_settings = ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")
    missing_settings = [name for name in required_settings if not os.getenv(name)]
    if missing_settings:
        missing = ", ".join(missing_settings)
        raise RuntimeError(
            f"Set DATABASE_URL or add {missing} to the repository .env file"
        )
    DATABASE_URL = URL.create(
        "postgresql+psycopg",
        username=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        database=os.environ["POSTGRES_DB"],
    ).render_as_string(hide_password=False)

if make_url(DATABASE_URL).get_backend_name() != "postgresql":
    raise RuntimeError("DATABASE_URL must use PostgreSQL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()