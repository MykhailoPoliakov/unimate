import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    required_settings = ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB")
    missing_settings = [name for name in required_settings if not os.getenv(name)]
    if missing_settings:
        missing = ", ".join(missing_settings)
        raise RuntimeError(
            f"Set DATABASE_URL or add {missing} to backend/.env"
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


def ensure_audience_columns() -> None:
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table in ("news", "socials"):
            if table not in inspector.get_table_names():
                continue
            columns = {column["name"] for column in inspector.get_columns(table)}
            if "program_slugs" not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN program_slugs TEXT"))
            if "year_list" not in columns:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN year_list TEXT"))
        if "users" in inspector.get_table_names():
            user_columns = {column["name"] for column in inspector.get_columns("users")}
            if "moderator_scope" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN moderator_scope TEXT"))
        if "buttons" in inspector.get_table_names():
            button_columns = {column["name"] for column in inspector.get_columns("buttons")}
            if "program_slugs" not in button_columns:
                connection.execute(text("ALTER TABLE buttons ADD COLUMN program_slugs TEXT"))
            if "year_list" not in button_columns:
                connection.execute(text("ALTER TABLE buttons ADD COLUMN year_list TEXT"))
            if "author_id" not in button_columns:
                connection.execute(text("ALTER TABLE buttons ADD COLUMN author_id UUID REFERENCES users(id) ON DELETE SET NULL"))
            if "created_at" not in button_columns:
                connection.execute(text("ALTER TABLE buttons ADD COLUMN created_at TIMESTAMPTZ"))
            connection.execute(text("ALTER TABLE buttons ALTER COLUMN icon TYPE VARCHAR(500)"))


ensure_audience_columns()


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()