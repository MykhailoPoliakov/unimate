from sqlalchemy import or_


def visible_to(model, institution_id: int, program_id: int, year: int):
    return (
        or_(model.institution_id.is_(None), model.institution_id == institution_id),
        or_(model.program_id.is_(None), model.program_id == program_id),
        or_(model.year_min.is_(None), model.year_min <= year),
        or_(model.year_max.is_(None), model.year_max >= year),
    )


def pick_translation(translations, lang: str):
    by_lang = {t.lang: t for t in translations}
    return by_lang.get(lang) or by_lang.get("en")