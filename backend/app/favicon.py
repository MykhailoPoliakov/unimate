import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from fastapi import HTTPException

MAX_HTML_BYTES = 400_000
FETCH_TIMEOUT = 6
USER_AGENT = "UniMateFavicon/1.0"


class _PageMetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title_chunks: list[str] = []
        self._in_title = False
        self.icons: list[tuple[int, str]] = []
        self.og_title: str | None = None

    def handle_starttag(self, tag, attrs):
        mapping = {key.lower(): value for key, value in attrs if value}
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            prop = (mapping.get("property") or mapping.get("name") or "").lower()
            if prop in {"og:title", "twitter:title"} and mapping.get("content"):
                self.og_title = mapping["content"].strip()
        if tag == "link":
            rel = (mapping.get("rel") or "").lower()
            href = mapping.get("href")
            if not href or "icon" not in rel:
                return
            size = 0
            for part in (mapping.get("sizes") or "").split():
                match = re.match(r"(\d+)x(\d+)", part.lower())
                if match:
                    size = max(size, int(match.group(1)))
            if "apple-touch-icon" in rel:
                size = max(size, 180)
            self.icons.append((size, href))

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title_chunks.append(data)


def _assert_public_http_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(422, "URL must be http or https")
    host = parsed.hostname.lower()
    if host in {"localhost", "metadata.google.internal"}:
        raise HTTPException(422, "That address is not allowed")
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError as error:
        raise HTTPException(422, "Could not resolve that site") from error
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(422, "That address is not allowed")


def _fetch(url: str, max_bytes: int = MAX_HTML_BYTES) -> bytes:
    _assert_public_http_url(url)
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    try:
        with urlopen(request, timeout=FETCH_TIMEOUT) as response:
            return response.read(max_bytes)
    except HTTPError as error:
        raise HTTPException(422, "Could not load that page") from error
    except (URLError, TimeoutError, OSError) as error:
        raise HTTPException(422, "Could not load that page") from error


def preview_website(url: str) -> dict[str, str | None]:
    html = _fetch(url).decode("utf-8", errors="ignore")
    parser = _PageMetaParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    title = (parser.og_title or "".join(parser.title_chunks)).strip()
    title = re.sub(r"\s+", " ", title)[:200] or None
    icons = sorted(parser.icons, key=lambda item: item[0], reverse=True)
    icon = urljoin(url, icons[0][1]) if icons else urljoin(url, "/favicon.ico")
    try:
        _assert_public_http_url(icon)
    except HTTPException:
        icon = None
    return {"title": title, "icon": icon}
