"""Fictional university for App Store screenshots, created through the admin API.

Add:    python demo_university.py <api-url> <admin-user-id>
Remove: python demo_university.py <api-url> <admin-user-id> --remove
"""

import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SLUG = "northfield"
BASE = "https://example.com/northfield"
LANGS = ("en", "nl", "de", "fr", "uk", "ru")

PROGRAMS = [
    {"slug": "cs", "name": "Computer Science", "duration_years": 3},
    {"slug": "design", "name": "Digital Design", "duration_years": 3},
]
BUTTONS = [
    ("learn", "Learning Hub", "Courses, assignments and grades", "book-outline", "47, 95, 168"),
    ("services", "Student Desk", "Student administration and requests", "school-outline", "225, 63, 43"),
    ("timetable", "Timetable", "Your classes and rooms", "calendar-outline", "34, 139, 94"),
    ("campus", "Campus Website", "Official news and information", "globe-outline", "28, 28, 28"),
]
SOCIALS = [
    ("community", "Student Community", "Chat with students from your program", "chatbubbles-outline"),
    ("events", "Campus Events", "Parties, trips and workshops", "calendar-outline"),
    ("photos", "Photo Club", "Pictures from around campus", "images-outline"),
    ("study", "Study Group", "Find people to study with", "people-outline"),
]


def translations(title, description):
    return [{"lang": lang, "title": title, "description": description} for lang in LANGS]


def main():
    api, user_id = sys.argv[1].rstrip("/"), sys.argv[2]

    def call(method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(
            api + path,
            data=data,
            method=method,
            headers={"X-User-Id": user_id, "Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=30) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except HTTPError as error:
            raise SystemExit(f"{method} {path} failed: {error.code} {error.read().decode()}")

    if "--remove" in sys.argv:
        call("DELETE", f"/institutions/{SLUG}")
        print("Demo university removed.")
        return

    call("POST", "/institutions", {"slug": SLUG, "name": "Northfield University"})
    for program in PROGRAMS:
        call("POST", f"/institutions/{SLUG}/programs", program)
    for index, (key, title, description, icon, color) in enumerate(BUTTONS, 1):
        call(
            "POST",
            "/buttons",
            {
                "url": f"{BASE}/{key}",
                "icon": icon,
                "color": color,
                "platform": "website",
                "sort_order": index,
                "institution": SLUG,
                "translations": translations(title, description),
            },
        )
    for index, (key, title, description, icon) in enumerate(SOCIALS, 1):
        call(
            "POST",
            "/socials",
            {
                "url": f"{BASE}/{key}",
                "icon": icon,
                "platform": "website",
                "sort_order": index,
                "institution": SLUG,
                "translations": translations(title, description),
            },
        )
    print("Demo university added.")


if __name__ == "__main__":
    main()
