from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import Button, ButtonTranslation, Institution, Program


INSTITUTIONS = [
    {
        "slug": "kdg",
        "name": "KdG University of Applied Sciences and Arts",
        "programs": [
            {"slug": "acs", "name": "Applied Computer Science", "duration_years": 3},
            {"slug": "ibm", "name": "International Business Management", "duration_years": 3},
        ],
    },
    # add the next university here, same shape
]

BUTTONS = [
    {
        "url": "https://canvas.kdg.be/",
        "institution": "kdg",
        "sort_order": 1,
        "translations": {
            "nl": ("Canvas", "Cursussen, opdrachten en punten"),
            "de": ("Canvas", "Kurse, Aufgaben und Noten"),
            "fr": ("Canvas", "Cours, devoirs et notes"),
            "en": ("Canvas", "Courses, assignments and grades"),
            "uk": ("Canvas", "Курси, завдання та оцінки"),
            "ru": ("Canvas", "Курсы, задания и оценки"),
        },
    },
    {
        "url": "https://E-studentservice.kdg.be/Main.aspx",
        "institution": "kdg",
        "sort_order": 2,
        "translations": {
            "nl": ("E-studentservice", "Studentenadministratie en aanvragen"),
            "de": ("E-studentservice", "Studentenverwaltung und Anträge"),
            "fr": ("E-studentservice", "Administration et demandes étudiantes"),
            "en": ("E-studentservice", "Student administration and requests"),
            "uk": ("E-studentservice", "Студентське адміністрування та запити"),
            "ru": ("E-studentservice", "Студенческие услуги и запросы"),
        },
    },
    {
        "url": "https://www.kdg.be/en",
        "institution": "kdg",
        "sort_order": 3,
        "translations": {
            "nl": ("KdG-website", "Officieel nieuws, opleidingen en info van KdG"),
            "de": ("KdG-Website", "Offizielle Website der KdG"),
            "fr": ("Site web de la KdG", "Site web officiel de la KdG"),
            "en": ("KdG Website", "Official KdG website"),
            "uk": ("Сайт KdG", "Офіційний сайт KdG"),
            "ru": ("Сайт KdG", "Официальный сайт KdG"),
        },
    },
    {
        "url": "https://cloud.timeedit.net/be_kdg/web/student/ri1Y315Q655Z54Q81.html",
        "institution": "kdg",
        "sort_order": 4,
        "translations": {
            "nl": ("Rooster", "Je lesrooster, lokalen en tijden"),
            "de": ("Stundenplan", "Dein Stundenplan, Räume und Zeiten"),
            "fr": ("Horaire", "Votre emploi du temps, locaux et horaires"),
            "en": ("Schedule", "Your class timetable, rooms and times"),
            "uk": ("Розклад", "Розклад занять, аудиторії та час"),
            "ru": ("Расписание", "Расписание занятий: аудитории и время"),
        },
    },
]


def seed():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for inst_data in INSTITUTIONS:
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
            seed_buttons(db)
        db.commit()


def seed_buttons(db):
    for data in BUTTONS:
        inst = db.scalar(select(Institution).where(Institution.slug == data["institution"]))
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
                sort_order=data["sort_order"],
                institution_id=inst.id,
            )
            db.add(button)
            db.flush()

        existing_languages = {translation.lang for translation in button.translations}
        button.translations.extend(
            ButtonTranslation(lang=lang, title=title, description=desc)
            for lang, (title, desc) in data["translations"].items()
            if lang not in existing_languages
        )
    db.commit()


if __name__ == "__main__":
    seed()