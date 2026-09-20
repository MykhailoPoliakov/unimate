from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.content import pick_translation, visible_to
from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import Institution, News, NewsTranslation, Program, User
from app.schemas import Language, NewsCreate, NewsOut, NewsTranslationOut

router = APIRouter(prefix="/news", tags=["news"])


def news_out(news: News, language: str) -> NewsOut | None:
    translation = pick_translation(news.translations, language)
    if translation is None:
        return None
    return NewsOut(
        id=news.id,
        is_published=news.is_published,
        translations=[
            NewsTranslationOut(
                lang=cast(Language, translation.lang),
                title=translation.title,
                body=translation.body,
            )
        ],
    )


@router.get("", response_model=list[NewsOut])
def list_news(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rules = visible_to(
        News,
        user.program.institution_id,
        user.program_id,
        year_of_study(user.enrollment_year),
    )
    news_items = db.scalars(
        select(News)
        .options(selectinload(News.translations))
        .where(News.is_published, *rules)
        .order_by(News.published_at.desc(), News.id.desc())
    ).all()
    return [result for item in news_items if (result := news_out(item, user.language))]


@router.post("", response_model=NewsOut, status_code=201)
def create_news(
    data: NewsCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    program = None
    if data.institution is not None or data.program is not None:
        if data.institution is None or data.program is None:
            raise HTTPException(422, "institution and program must be provided together")
        program = db.scalar(
            select(Program)
            .join(Institution)
            .where(Institution.slug == data.institution, Program.slug == data.program)
        )
        if program is None:
            raise HTTPException(404, "Unknown institution or program")

    if data.year_min is not None and data.year_max is not None and data.year_min > data.year_max:
        raise HTTPException(422, "year_min cannot exceed year_max")

    news = News(
        is_published=data.is_published,
        published_at=datetime.now(timezone.utc) if data.is_published else None,
        institution_id=program.institution_id if program else None,
        program_id=program.id if program else None,
        year_min=data.year_min,
        year_max=data.year_max,
        translations=[
            NewsTranslation(lang=item.lang, title=item.title, body=item.body)
            for item in data.translations
        ],
    )
    db.add(news)
    db.commit()
    db.refresh(news)
    return NewsOut(
        id=news.id,
        is_published=news.is_published,
        translations=[NewsTranslationOut.model_validate(item) for item in news.translations],
    )