from datetime import date


def academic_year_start(today: date | None = None) -> int:
    today = today or date.today()
    return today.year if today.month >= 9 else today.year - 1


def enrollment_year_for(year_of_study: int) -> int:
    return academic_year_start() - (year_of_study - 1)


def year_of_study(enrollment_year: int) -> int:
    return academic_year_start() - enrollment_year + 1