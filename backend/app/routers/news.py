from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.content import pick_translation, visible_to
from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models import Institution, News, NewsTranslation, NewsVote, Program, User
from app.poll import poll_options_from_news
from app.schemas import Language, NewsCreate, NewsOut, NewsPollOut, NewsTranslationOut, NewsVoteIn

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


def _resolve_program(data: NewsCreate, db: Session):
    if data.institution is None and data.program is None:
        return None
    if data.institution is None or data.program is None:
        raise HTTPException(422, "institution and program must be provided together")
    program = db.scalar(
        select(Program)
        .join(Institution)
        .where(Institution.slug == data.institution, Program.slug == data.program)
    )
    if program is None:
        raise HTTPException(404, "Unknown institution or program")
    return program


def _created_out(news: News) -> NewsOut:
    return NewsOut(
        id=news.id,
        is_published=news.is_published,
        translations=[
            NewsTranslationOut(
                lang=cast(Language, item.lang),
                title=item.title,
                body=item.body,
            )
            for item in news.translations
        ],
    )


@router.post("", response_model=NewsOut, status_code=201)
def create_news(
    data: NewsCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    program = _resolve_program(data, db)

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
    return _created_out(news)


@router.patch("/{news_id}", response_model=NewsOut)
def update_news(
    news_id: int,
    data: NewsCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    news = db.scalar(
        select(News).options(selectinload(News.translations)).where(News.id == news_id)
    )
    if news is None:
        raise HTTPException(404, "Not found")

    if data.year_min is not None and data.year_max is not None and data.year_min > data.year_max:
        raise HTTPException(422, "year_min cannot exceed year_max")

    program = _resolve_program(data, db)
    news.is_published = data.is_published
    if data.is_published and news.published_at is None:
        news.published_at = datetime.now(timezone.utc)
    news.institution_id = program.institution_id if program else None
    news.program_id = program.id if program else None
    news.year_min = data.year_min
    news.year_max = data.year_max
    news.translations.clear()
    news.translations.extend(
        NewsTranslation(lang=item.lang, title=item.title, body=item.body)
        for item in data.translations
    )
    db.commit()
    db.refresh(news)
    return _created_out(news)


@router.delete("/{news_id}", status_code=204)
def delete_news(
    news_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    news = db.get(News, news_id)
    if news is None:
        raise HTTPException(404, "Not found")
    db.delete(news)
    db.commit()


def _visible_news(news_id: int, user: User, db: Session) -> News:
    rules = visible_to(
        News,
        user.program.institution_id,
        user.program_id,
        year_of_study(user.enrollment_year),
    )
    news = db.scalar(
        select(News)
        .options(selectinload(News.translations))
        .where(News.id == news_id, News.is_published, *rules)
    )
    if news is None:
        raise HTTPException(404, "Not found")
    return news


def _poll_out(news: News, user: User, db: Session) -> NewsPollOut:
    options = poll_options_from_news(news)
    if len(options) < 2:
        raise HTTPException(404, "No poll")
    counts = [0] * len(options)
    rows = db.execute(
        select(NewsVote.option_index, func.count())
        .where(NewsVote.news_id == news.id)
        .group_by(NewsVote.option_index)
    ).all()
    for option_index, count in rows:
        if 0 <= option_index < len(options):
            counts[option_index] = count
    yours = db.scalar(
        select(NewsVote.option_index).where(
            NewsVote.news_id == news.id, NewsVote.user_id == user.id
        )
    )
    return NewsPollOut(
        options=options,
        counts=counts,
        total=sum(counts),
        your_vote=yours,
    )


@router.get("/{news_id}/poll", response_model=NewsPollOut)
def get_news_poll(
    news_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    news = _visible_news(news_id, user, db)
    return _poll_out(news, user, db)


@router.post("/{news_id}/poll", response_model=NewsPollOut)
def vote_news_poll(
    news_id: int,
    data: NewsVoteIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    news = _visible_news(news_id, user, db)
    options = poll_options_from_news(news)
    if len(options) < 2:
        raise HTTPException(404, "No poll")
    if data.option_index >= len(options):
        raise HTTPException(422, "Unknown poll option")
    vote = db.get(NewsVote, (news.id, user.id))
    if vote is None:
        db.add(NewsVote(news_id=news.id, user_id=user.id, option_index=data.option_index))
    else:
        vote.option_index = data.option_index
    db.commit()
    return _poll_out(news, user, db)