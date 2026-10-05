import json
import logging
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.academic import year_of_study
from app.content import matches_audience, pick_translation
from app.db import SessionLocal
from app.models import News, Program, PushToken, User

logger = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MAX_PUSH_BATCH_SIZE = 100


def build_news_push_messages(news: News, db: Session) -> list[dict]:
    if not news.is_published:
        return []

    recipients = db.execute(
        select(
            PushToken.token,
            User.language,
            User.enrollment_year,
            User.program_id,
            Program.institution_id,
            Program.slug,
        )
        .join(User, User.id == PushToken.user_id)
        .join(Program, Program.id == User.program_id)
        .where(PushToken.enabled.is_(True))
    ).all()

    messages = []
    for token, language, enrollment_year, program_id, institution_id, program_slug in recipients:
        study_year = year_of_study(enrollment_year)
        if not matches_audience(news, institution_id, program_id, program_slug, study_year):
            continue

        translation = pick_translation(news.translations, language)
        if translation is None:
            continue
        body = (translation.excerpt or translation.body or "Open UniMate to read the update.").strip()
        if len(body) > 220:
            body = f"{body[:217].rstrip()}..."

        messages.append(
            {
                "to": token,
                "title": translation.title,
                "body": body,
                "sound": "default",
                "priority": "high",
                "channelId": "unimate-info",
                "data": {"screen": "news", "newsId": news.id},
            }
        )
    return messages


def _send_batch(messages: list[dict]) -> list[str]:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",
    }
    access_token = os.getenv("EXPO_ACCESS_TOKEN")
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    payload = json.dumps(messages).encode("utf-8")
    response_data = None
    for attempt in range(3):
        request = Request(
            EXPO_PUSH_URL,
            data=payload,
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=15) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as error:
            if error.code == 429 or error.code >= 500:
                if attempt < 2:
                    time.sleep(2**attempt)
                    continue
            logger.warning("Expo push request failed with HTTP %s", error.code)
            return []
        except (TimeoutError, URLError, OSError) as error:
            if attempt < 2:
                time.sleep(2**attempt)
                continue
            logger.warning("Expo push request failed: %s", error)
            return []

    invalid_tokens = []
    for message, ticket in zip(messages, (response_data or {}).get("data", [])):
        details = ticket.get("details") or {}
        if ticket.get("status") == "error":
            logger.warning("Expo push ticket error: %s", ticket.get("message"))
            if details.get("error") == "DeviceNotRegistered":
                invalid_tokens.append(message["to"])
    return invalid_tokens


def send_news_pushes(news_id: int) -> None:
    try:
        with SessionLocal() as db:
            news = db.scalar(
                select(News)
                .options(selectinload(News.translations))
                .where(News.id == news_id, News.is_published)
            )
            if news is None:
                logger.warning("News %s not found for push", news_id)
                return
            messages = build_news_push_messages(news, db)

        logger.info("Sending %s news push(es) for news %s", len(messages), news_id)
        if not messages:
            return

        invalid_tokens = []
        for start in range(0, len(messages), MAX_PUSH_BATCH_SIZE):
            invalid_tokens.extend(
                _send_batch(messages[start : start + MAX_PUSH_BATCH_SIZE])
            )

        if invalid_tokens:
            with SessionLocal() as db:
                db.execute(
                    update(PushToken)
                    .where(PushToken.token.in_(invalid_tokens))
                    .values(enabled=False)
                )
                db.commit()
    except Exception:
        logger.exception("Failed to send news pushes for %s", news_id)