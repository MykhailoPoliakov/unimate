import unittest

from app.schemas import NewsCreate


class NewsRichContentSchemaTest(unittest.TestCase):
    def test_news_create_accepts_rich_media_fields(self):
        payload = {
            "translations": [
                {
                    "lang": "en",
                    "title": "Summer internship fair",
                    "excerpt": "Meet employers and discover internship roles.",
                    "body": "A full-day event will help students explore internships.",
                    "hero_image_url": "https://cdn.example.com/news/internship-fair.jpg",
                    "hero_image_alt": "Students networking at an internship fair",
                    "cta_label": "Register now",
                    "cta_url": "https://example.com/register",
                    "tags": ["career", "event"],
                    "blocks": [
                        {"type": "paragraph", "content": "We are excited to welcome local employers."},
                        {"type": "button", "label": "View schedule", "url": "https://example.com/schedule"},
                    ],
                }
            ],
            "is_published": True,
        }

        news = NewsCreate.model_validate(payload)

        translation = news.translations[0]
        self.assertEqual(translation.hero_image_url, "https://cdn.example.com/news/internship-fair.jpg")
        self.assertEqual(translation.cta_url, "https://example.com/register")
        self.assertEqual(translation.tags, ["career", "event"])
        self.assertEqual(translation.blocks[0].type, "paragraph")
