import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(200))

    programs: Mapped[list["Program"]] = relationship(
        back_populates="institution", order_by="Program.slug"
    )


class Program(Base):
    __tablename__ = "programs"
    __table_args__ = (
        UniqueConstraint("institution_id", "slug"),
        CheckConstraint("duration_years > 0"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"))
    slug: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(200))
    duration_years: Mapped[int]

    institution: Mapped[Institution] = relationship(back_populates="programs")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('student', 'admin')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"))
    language: Mapped[str] = mapped_column(String(5), default="en")
    enrollment_year: Mapped[int]
    role: Mapped[str] = mapped_column(String(10), default="student", server_default="student")

    program: Mapped[Program] = relationship()


class Button(Base):
    __tablename__ = "buttons"
    __table_args__ = (
        CheckConstraint("year_min IS NULL OR year_max IS NULL OR year_min <= year_max"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str] = mapped_column(String(500))
    icon: Mapped[str | None] = mapped_column(String(100))
    platform: Mapped[str | None] = mapped_column(String(30))
    sort_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    # targeting: NULL means "everyone"
    institution_id: Mapped[int | None] = mapped_column(ForeignKey("institutions.id"))
    program_id: Mapped[int | None] = mapped_column(ForeignKey("programs.id"))
    year_min: Mapped[int | None]
    year_max: Mapped[int | None]

    translations: Mapped[list["ButtonTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class ButtonTranslation(Base):
    __tablename__ = "button_translations"

    button_id: Mapped[int] = mapped_column(
        ForeignKey("buttons.id", ondelete="CASCADE"), primary_key=True
    )
    lang: Mapped[str] = mapped_column(String(5), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(500))


class News(Base):
    __tablename__ = "news"
    __table_args__ = (
        CheckConstraint("year_min IS NULL OR year_max IS NULL OR year_min <= year_max"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    is_published: Mapped[bool] = mapped_column(default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    institution_id: Mapped[int | None] = mapped_column(ForeignKey("institutions.id"))
    program_id: Mapped[int | None] = mapped_column(ForeignKey("programs.id"))
    year_min: Mapped[int | None]
    year_max: Mapped[int | None]

    translations: Mapped[list["NewsTranslation"]] = relationship(
        cascade="all, delete-orphan"
    )


class NewsTranslation(Base):
    __tablename__ = "news_translations"

    news_id: Mapped[int] = mapped_column(
        ForeignKey("news.id", ondelete="CASCADE"), primary_key=True
    )
    lang: Mapped[str] = mapped_column(String(5), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)