from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = "sqlite:///./unimate.db"

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
    if users_schema and user_columns and "'basic'" in users_schema[0]:
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
                CONSTRAINT ck_users_role CHECK (role IN ('student', 'admin')),
                FOREIGN KEY(program_id) REFERENCES programs (id)
            )
            """
        )
        cursor.execute(
            """
            INSERT INTO users_new
                (id, created_at, program_id, language, enrollment_year, role)
            SELECT id, created_at, program_id, language, enrollment_year,
                CASE WHEN role = 'basic' THEN 'student' ELSE role END
            FROM users
            """
        )
        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_new RENAME TO users")
        cursor.execute("PRAGMA foreign_keys=ON")
    elif user_columns and "role" not in user_columns:
        cursor.execute(
            "ALTER TABLE users ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'student'"
        )
    elif user_columns:
        cursor.execute("UPDATE users SET role = 'student' WHERE role = 'basic'")
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
    dbapi_connection.commit()
    cursor.close()