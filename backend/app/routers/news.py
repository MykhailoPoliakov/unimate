import json
from datetime import datetime, timezone
from collections import defaultdict
from typing import Any, cast

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.content import pick_translation, visible_to
from app.db import get_db
from app.deps import get_current_user, require_news_manager
from app.models import Institution, News, NewsTranslation, NewsVote, Program, User
from app.poll import poll_options_from_news
from app.push import send_news_pushes
from app.schemas import Language, NewsCreate, NewsOut, NewsPollOut, NewsTranslationOut, NewsVoteIn

router = APIRouter(prefix="/news", tags=["news"])


def _parse_json_list(value: str | None) -> list[Any]:
    if value in (None, ""):
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def _serialize_json(value: list[Any] | dict[str, Any] | None) -> str | None:
    if value in (None, [], {}):
        return None
    return json.dumps(value, ensure_ascii=False)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _poll_snapshot(news: News, counts_by_option: dict[int, int], your_vote: int | None) -> NewsPollOut | None:
    options = poll_options_from_news(news)
    if len(options) < 2:
        return None
    counts = [counts_by_option.get(index, 0) for index in range(len(options))]
    return NewsPollOut(
        options=options,
        counts=counts,
        total=sum(counts),
        your_vote=your_vote,
    )


def news_out(news: News, language: str, poll: NewsPollOut | None = None) -> NewsOut | None:
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
                excerpt=translation.excerpt,
                body=translation.body,
                hero_image_url=translation.hero_image_url,
                hero_image_alt=translation.hero_image_alt,
                cta_label=translation.cta_label,
                cta_url=translation.cta_url,
                tags=_parse_json_list(translation.tags),
                blocks=_parse_json_list(translation.blocks),
            )
        ],
        created_at=_as_utc(news.created_at or news.published_at),
        poll=poll,
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
        .order_by(News.created_at.desc(), News.published_at.desc(), News.id.desc())
    ).all()
    news_ids = [item.id for item in news_items]
    counts_by_news: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    yours_by_news: dict[int, int] = {}
    if news_ids:
        for news_id, option_index, count in db.execute(
            select(NewsVote.news_id, NewsVote.option_index, func.count())
            .where(NewsVote.news_id.in_(news_ids))
            .group_by(NewsVote.news_id, NewsVote.option_index)
        ).all():
            counts_by_news[news_id][option_index] = count
        yours_by_news = dict(
            db.execute(
                select(NewsVote.news_id, NewsVote.option_index).where(
                    NewsVote.news_id.in_(news_ids),
                    NewsVote.user_id == user.id,
                )
            ).all()
        )
    return [
        result
        for item in news_items
        if (
            result := news_out(
                item,
                user.language,
                _poll_snapshot(item, counts_by_news[item.id], yours_by_news.get(item.id)),
            )
        )
    ]


@router.get("/manage", response_model=list[NewsOut])
def list_managed_news(
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    query = select(News).options(selectinload(News.translations))
    if user.role != "admin":
        query = query.where(News.author_id == user.id)
    news_items = db.scalars(
        query.order_by(News.created_at.desc(), News.id.desc())
    ).all()
    return [_created_out(item) for item in news_items]


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


def _ensure_can_manage(news: News, user: User) -> None:
    if user.role == "moderator" and news.author_id != user.id:
        raise HTTPException(404, "Not found")


def _translation_row(item) -> NewsTranslation:
    return NewsTranslation(
        lang=item.lang,
        title=item.title,
        excerpt=item.excerpt,
        body=item.body,
        hero_image_url=item.hero_image_url,
        hero_image_alt=item.hero_image_alt,
        cta_label=item.cta_label,
        cta_url=item.cta_url,
        tags=_serialize_json(item.tags),
        blocks=_serialize_json([block.model_dump(mode="json") for block in item.blocks]),
    )


def _created_out(news: News) -> NewsOut:
    return NewsOut(
        id=news.id,
        is_published=news.is_published,
        created_at=_as_utc(news.created_at or news.published_at),
        translations=[
            NewsTranslationOut(
                lang=cast(Language, item.lang),
                title=item.title,
                excerpt=item.excerpt,
                body=item.body,
                hero_image_url=item.hero_image_url,
                hero_image_alt=item.hero_image_alt,
                cta_label=item.cta_label,
                cta_url=item.cta_url,
                tags=_parse_json_list(item.tags),
                blocks=_parse_json_list(item.blocks),
            )
            for item in news.translations
        ],
    )


@router.post("", response_model=NewsOut, status_code=201)
def create_news(
    data: NewsCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    program = _resolve_program(data, db)

    if data.year_min is not None and data.year_max is not None and data.year_min > data.year_max:
        raise HTTPException(422, "year_min cannot exceed year_max")

    news = News(
        is_published=data.is_published,
        created_at=datetime.now(timezone.utc),
        published_at=datetime.now(timezone.utc) if data.is_published else None,
        institution_id=program.institution_id if program else None,
        program_id=program.id if program else None,
        year_min=data.year_min,
        year_max=data.year_max,
        author_id=user.id,
        translations=[_translation_row(item) for item in data.translations],
    )
    db.add(news)
    db.commit()
    db.refresh(news)
    if news.is_published:
        background_tasks.add_task(send_news_pushes, news.id)
    return _created_out(news)


@router.patch("/{news_id}", response_model=NewsOut)
def update_news(
    news_id: int,
    data: NewsCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    news = db.scalar(
        select(News).options(selectinload(News.translations)).where(News.id == news_id)
    )
    if news is None:
        raise HTTPException(404, "Not found")
    _ensure_can_manage(news, user)

    if data.year_min is not None and data.year_max is not None and data.year_min > data.year_max:
        raise HTTPException(422, "year_min cannot exceed year_max")

    program = _resolve_program(data, db)
    was_published = news.is_published
    news.is_published = data.is_published
    if data.is_published and news.published_at is None:
        news.published_at = datetime.now(timezone.utc)
    news.institution_id = program.institution_id if program else None
    news.program_id = program.id if program else None
    news.year_min = data.year_min
    news.year_max = data.year_max
    news.translations.clear()
    news.translations.extend(_translation_row(item) for item in data.translations)
    db.commit()
    db.refresh(news)
    if data.is_published and not was_published:
        background_tasks.add_task(send_news_pushes, news.id)
    return _created_out(news)


@router.delete("/{news_id}", status_code=204)
def delete_news(
    news_id: int,
    user: User = Depends(require_news_manager),
    db: Session = Depends(get_db),
):
    news = db.get(News, news_id)
    if news is None:
        raise HTTPException(404, "Not found")
    _ensure_can_manage(news, user)
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
    counts = defaultdict(int)
    for option_index, count in db.execute(
        select(NewsVote.option_index, func.count())
        .where(NewsVote.news_id == news.id)
        .group_by(NewsVote.option_index)
    ).all():
        counts[option_index] = count
    yours = db.scalar(
        select(NewsVote.option_index).where(
            NewsVote.news_id == news.id, NewsVote.user_id == user.id
        )
    )
    poll = _poll_snapshot(news, counts, yours)
    if poll is None:
        raise HTTPException(404, "No poll")
    return poll


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


@router.delete("/{news_id}/poll", response_model=NewsPollOut)
def retract_news_poll(
    news_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    news = _visible_news(news_id, user, db)
    vote = db.get(NewsVote, (news.id, user.id))
    if vote is not None:
        db.delete(vote)
        db.commit()
    return _poll_out(news, user, db)
