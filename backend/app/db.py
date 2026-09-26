from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = Path(__file__).resolve().parents[1] / "unimate.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
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


from sqlalchemy import event


@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, _):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    users_schema = cursor.fetchone()
    cursor.execute("PRAGMA table_info(users)")
    user_columns = {row[1] for row in cursor.fetchall()}
    if users_schema and user_columns and (
        "'basic'" in users_schema[0]
        or "role" not in user_columns
        or "'moderator'" not in users_schema[0]
    ):
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.execute("DROP TABLE IF EXISTS users_new")
        cursor.execute(
            """
            CREATE TABLE users_new (
                id CHAR(32) NOT NULL PRIMARY KEY,
                created_at DATETIME NOT NULL,
                program_id INTEGER NOT NULL,
                language VARCHAR(5) NOT NULL,
                enrollment_year INTEGER NOT NULL,
                role VARCHAR(10) NOT NULL DEFAULT 'student',
                CONSTRAINT ck_users_role CHECK (role IN ('student', 'moderator', 'admin')),
                FOREIGN KEY(program_id) REFERENCES programs (id)
            )
            """
        )
        role_value = (
            "CASE WHEN role = 'basic' THEN 'student' ELSE role END"
            if "role" in user_columns
            else "'student'"
        )
        cursor.execute(
            f"""
            INSERT INTO users_new
                (id, created_at, program_id, language, enrollment_year, role)
            SELECT id, created_at, program_id, language, enrollment_year, {role_value}
            FROM users
            """
        )
        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_new RENAME TO users")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS news_votes (
            news_id INTEGER NOT NULL,
            user_id CHAR(32) NOT NULL,
            option_index INTEGER NOT NULL,
            PRIMARY KEY (news_id, user_id),
            FOREIGN KEY(news_id) REFERENCES news (id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    cursor.execute("PRAGMA table_info(news_translations)")
    news_translation_columns = {row[1] for row in cursor.fetchall()}
    if news_translation_columns:
        for name, definition in (
            ("excerpt", "VARCHAR(300)"),
            ("hero_image_url", "VARCHAR(500)"),
            ("hero_image_alt", "VARCHAR(200)"),
            ("cta_label", "VARCHAR(100)"),
            ("cta_url", "VARCHAR(500)"),
            ("tags", "TEXT"),
            ("blocks", "TEXT"),
        ):
            if name not in news_translation_columns:
                cursor.execute(f"ALTER TABLE news_translations ADD COLUMN {name} {definition}")
    cursor.execute("PRAGMA table_info(buttons)")
    button_columns = {row[1] for row in cursor.fetchall()}
    if button_columns and "color" not in button_columns:
        cursor.execute("ALTER TABLE buttons ADD COLUMN color VARCHAR(32)")
    cursor.execute("PRAGMA table_info(news)")
    news_columns = {row[1] for row in cursor.fetchall()}
    if news_columns and "author_id" not in news_columns:
        cursor.execute(
            "ALTER TABLE news ADD COLUMN author_id CHAR(32) "
            "REFERENCES users (id) ON DELETE SET NULL"
        )
    if news_columns and "created_at" not in news_columns:
        cursor.execute("ALTER TABLE news ADD COLUMN created_at DATETIME")
        cursor.execute(
            "UPDATE news SET created_at = COALESCE(published_at, updated_at) WHERE created_at IS NULL"
        )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS push_tokens (
            token VARCHAR(255) NOT NULL PRIMARY KEY,
            user_id CHAR(32) NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    dbapi_connection.commit()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()