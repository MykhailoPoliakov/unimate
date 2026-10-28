"""Fictional university for App Store screenshots, created through the admin API.

Add:    python demo_university.py <api-url> <admin-user-id>
Remove: python demo_university.py <api-url> <admin-user-id> --remove

Links point to neutral, openly licensed public sites so real icons are parsed.
Home buttons are a per-university config that only an admin of that university
can save, so the admin profile is switched to the demo uni and then restored.
"""

import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

SLUG = "northfield"
LANGS = ("en", "nl", "de", "fr", "uk", "ru")

PROGRAMS = [
    {"slug": "cs", "name": "Computer Science", "duration_years": 3},
    {"slug": "design", "name": "Digital Design", "duration_years": 3},
]
BUTTONS = [
    ("learn", "Learning Hub", "Courses, assignments and grades", "https://en.wikipedia.org/", "47, 95, 168"),
    ("services", "Student Desk", "Student administration and requests", "https://archive.org/", "225, 63, 43"),
    ("campus", "Campus Map", "Find buildings and rooms", "https://www.openstreetmap.org/", "34, 139, 94"),
    ("library", "Library", "Books and study material", "https://openlibrary.org/", "28, 28, 28"),
    ("schedule", "Schedule", "Class timetable", "https://www.timeanddate.com/", "140, 232, 196"),
]
SOCIALS = [
    ("Student Community", "Chat with students from your program", "chatbubbles-outline", "https://www.reddit.com/"),
    ("Campus Events", "Parties, trips and workshops", "calendar-outline", "https://www.eventbrite.com/"),
    ("Photo Club", "Pictures from around campus", "images-outline", "https://unsplash.com/"),
    ("Study Group", "Find people to study with", "people-outline", "https://www.coursera.org/"),
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

    def exists_ok(method, path, body):
        try:
            call(method, path, body)
        except SystemExit as error:
            if "409" not in str(error) and "already" not in str(error).lower():
                raise

    if "--remove" in sys.argv:
        for social in call("GET", "/socials/manage"):
            if social["institution"] == SLUG:
                call("DELETE", f"/socials/{social['id']}")
        for button in call("GET", "/buttons/manage"):
            if button["institution"] == SLUG:
                call("DELETE", f"/buttons/{button['id']}")
        call("DELETE", f"/institutions/{SLUG}")
        print("Demo university removed.")
        return

    exists_ok("POST", "/institutions", {"slug": SLUG, "name": "Northfield University"})
    for program in PROGRAMS:
        exists_ok("POST", f"/institutions/{SLUG}/programs", program)
    audience = {
        "institution": SLUG,
        "programs": [program["slug"] for program in PROGRAMS],
        "years": [1, 2, 3],
    }
    existing = {s["url"] for s in call("GET", "/socials/manage") if s["institution"] == SLUG}
    for index, (title, description, icon, url) in enumerate(SOCIALS, 1):
        if url in existing:
            continue
        call(
            "POST",
            "/socials",
            {
                "url": url,
                "icon": icon,
                "platform": "website",
                "sort_order": index,
                **audience,
                "translations": translations(title, description),
            },
        )

    me = call("GET", f"/users/{user_id}")
    call("PATCH", f"/users/{user_id}", {"institution": SLUG, "program": "cs", "year_of_study": 3})
    try:
        call(
            "PUT",
            "/home-buttons",
            {
                "buttons": [
                    {
                        "id": f"{SLUG}-{key}",
                        "title": title,
                        "description": description,
                        "url": url,
                        "color": color,
                        "platform": "website",
                    }
                    for key, title, description, url, color in BUTTONS
                ]
            },
        )
    finally:
        call(
            "PATCH",
            f"/users/{user_id}",
            {
                "institution": me["institution"],
                "program": me["program"],
                "year_of_study": me["year_of_study"],
            },
        )
    print("Demo university added.")


if __name__ == "__main__":
    main()
