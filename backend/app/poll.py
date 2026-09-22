MARKER_START = "\n\n<!--unimate-poll\n"
MARKER_END = "\n-->"


def parse_poll_options(raw: str | None) -> list[str]:
    text = raw or ""
    start = text.rfind(MARKER_START)
    if start < 0 or not text.endswith(MARKER_END):
        return []
    inner = text[start + len(MARKER_START) : -len(MARKER_END)]
    return [line.strip() for line in inner.split("\n") if line.strip()]


def poll_options_from_news(news) -> list[str]:
    for translation in news.translations:
        options = parse_poll_options(translation.body)
        if len(options) >= 2:
            return options
    return []
