import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import (  # noqa: F401 — register every table for drop_all
    Button,
    ButtonTranslation,
    Institution,
    News,
    NewsTranslation,
    NewsVote,
    Program,
    Social,
    SocialTranslation,
    User,
)


SEED_DATA_PATH = Path(__file__).resolve().parents[1] / "seed-data.json"


def load_seed_data() -> dict:
    with SEED_DATA_PATH.open(encoding="utf-8") as file:
        data = json.load(file)

    for key in ("institutions", "buttons", "socials", "news"):
        if not isinstance(data.get(key), list):
            raise ValueError(f"Seed data field {key!r} must be a list")
    return data


def reset_database() -> None:
    print("Resetting configured database")
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def seed():
    reset_database()
    data = load_seed_data()
    Base.metadata.create_all(engine)
    print("Seeded institutions, buttons, socials, and news.")
    with SessionLocal() as db:
        for inst_data in data["institutions"]:
            inst = db.scalar(
                select(Institution).where(Institution.slug == inst_data["slug"])
            )
            if inst is None:
                inst = Institution(slug=inst_data["slug"], name=inst_data["name"])
                db.add(inst)
                db.flush()
            else:
                inst.name = inst_data["name"]

            for prog_data in inst_data["programs"]:
                prog = db.scalar(
                    select(Program).where(
                        Program.institution_id == inst.id,
                        Program.slug == prog_data["slug"],
                    )
                )
                if prog is None:
                    db.add(Program(institution_id=inst.id, **prog_data))
                else:
                    prog.name = prog_data["name"]
                    prog.duration_years = prog_data["duration_years"]

        db.flush()
        seed_buttons(db, data["buttons"])
        seed_socials(db, data["socials"])
        seed_news(db, data["news"])
        db.commit()


def seed_buttons(db, buttons):
    for data in buttons:
        inst = db.scalar(
            select(Institution).where(Institution.slug == data["institution"])
        )
        if inst is None:
            raise ValueError(f"Unknown institution {data['institution']!r}")

        button = db.scalars(
            select(Button).where(
                Button.url == data["url"],
                Button.sort_order == data["sort_order"],
                Button.institution_id == inst.id,
            )
        ).first()
        if button is None:
            button = Button(
                url=data["url"],
                icon=data.get("icon"),
                color=data.get("color"),
                platform=data.get("platform"),
                sort_order=data["sort_order"],
                institution_id=inst.id,
            )
            db.add(button)
            db.flush()
        else:
            button.icon = data.get("icon")
            button.color = data.get("color")
            button.platform = data.get("platform")

        existing_languages = {translation.lang for translation in button.translations}
        button.translations.extend(
            ButtonTranslation(
                lang=lang,
                title=values[0],
                description=values[1],
            )
            for lang, values in data["translations"].items()
            if lang not in existing_languages
        )


def seed_socials(db, socials):
    for data in socials:
        inst = db.scalar(
            select(Institution).where(Institution.slug == data["institution"])
        )
        if inst is None:
            raise ValueError(f"Unknown institution {data['institution']!r}")

        program = None
        if data.get("program") is not None:
            program = db.scalar(
                select(Program).where(
                    Program.institution_id == inst.id,
                    Program.slug == data["program"],
                )
            )
            if program is None:
                raise ValueError(
                    f"Unknown program {data['program']!r} for institution "
                    f"{data['institution']!r}"
                )

        program_id = program.id if program is not None else None
        year_min = data.get("year_min")
        year_max = data.get("year_max")
        social = db.scalars(
            select(Social).where(
                Social.url == data["url"],
                Social.sort_order == data["sort_order"],
                Social.institution_id == inst.id,
                Social.program_id == program_id,
                Social.year_min == year_min,
                Social.year_max == year_max,
            )
        ).first()
        if social is None:
            social = Social(
                url=data["url"],
                icon=data.get("icon"),
                platform=data.get("platform"),
                sort_order=data["sort_order"],
                is_active=data.get("is_active", True),
                institution_id=inst.id,
                program_id=program_id,
                year_min=year_min,
                year_max=year_max,
            )
            db.add(social)
            db.flush()
        else:
            social.icon = data.get("icon")
            social.platform = data.get("platform")
            social.is_active = data.get("is_active", True)

        existing_languages = {translation.lang for translation in social.translations}
        social.translations.extend(
            SocialTranslation(
                lang=lang,
                title=values[0],
                description=values[1],
            )
            for lang, values in data["translations"].items()
            if lang not in existing_languages
        )


def seed_news(db, news_items):
    for index, item in enumerate(news_items):
        institution = None
        if item.get("institution") is not None:
            institution = db.scalar(
                select(Institution).where(Institution.slug == item["institution"])
            )
            if institution is None:
                raise ValueError(f"Unknown institution {item['institution']!r}")

        program = None
        if item.get("program") is not None:
            if institution is None:
                raise ValueError(
                    f"Program {item['program']!r} requires an institution slug for news seed item"
                )
            program = db.scalar(
                select(Program).where(
                    Program.institution_id == institution.id,
                    Program.slug == item["program"],
                )
            )
            if program is None:
                raise ValueError(
                    f"Unknown program {item['program']!r} for institution "
                    f"{item.get('institution')!r}"
                )

        news = News(
            is_published=True,
            created_at=datetime.now(timezone.utc) - timedelta(days=index * 3 + 1),
            published_at=datetime.now(timezone.utc) - timedelta(days=index * 3 + 1),
            institution_id=institution.id if institution is not None else None,
            program_id=program.id if program is not None else None,
            year_min=item.get("year_min"),
            year_max=item.get("year_max"),
            translations=[
                NewsTranslation(
                    lang=lang,
                    title=translation["title"],
                    excerpt=translation.get("excerpt"),
                    body=translation["body"],
                    hero_image_url=translation.get("hero_image_url"),
                    hero_image_alt=translation.get("hero_image_alt"),
                    cta_label=translation.get("cta_label"),
                    cta_url=translation.get("cta_url"),
                    tags=json.dumps(translation.get("tags", [])),
                    blocks=json.dumps(translation.get("blocks", [])),
                )
                for lang, translation in item["translations"].items()
            ],
        )
        db.add(news)


if __name__ == "__main__":
    seed()
