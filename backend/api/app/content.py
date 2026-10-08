import json

from sqlalchemy import or_


def parse_json_list(value):
    if value in (None, ""):
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def serialize_json_list(value):
    if not value:
        return None
    return json.dumps(value, ensure_ascii=False)


def visible_to(model, institution_id: int, program_id: int, year: int):
    return (
        or_(model.institution_id.is_(None), model.institution_id == institution_id),
        or_(model.program_id.is_(None), model.program_id == program_id),
        or_(model.year_min.is_(None), model.year_min <= year),
        or_(model.year_max.is_(None), model.year_max >= year),
    )


def visible_to_institution(model, institution_id: int):
    return (or_(model.institution_id.is_(None), model.institution_id == institution_id),)


def matches_audience(item, institution_id: int, program_id: int, program_slug: str, year: int) -> bool:
    if item.institution_id not in (None, institution_id):
        return False
    slugs = [str(slug) for slug in parse_json_list(getattr(item, "program_slugs", None))]
    if slugs:
        if program_slug not in slugs:
            return False
    elif item.program_id not in (None, program_id):
        return False
    years = []
    for entry in parse_json_list(getattr(item, "year_list", None)):
        try:
            years.append(int(entry))
        except (TypeError, ValueError):
            continue
    if years:
        if year not in years:
            return False
    else:
        if item.year_min is not None and year < item.year_min:
            return False
        if item.year_max is not None and year > item.year_max:
            return False
    return True


def pick_translation(translations, lang: str):
    by_lang = {t.lang: t for t in translations}
    return by_lang.get(lang) or by_lang.get("en")
