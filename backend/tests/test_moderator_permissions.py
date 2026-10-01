import json
import os
import unittest
import uuid
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine, select

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.db import Base
from app.deps import require_admin, require_news_manager
from app.models import Institution, News, NewsTranslation, Program, PushToken, User
from app.push import _send_batch, build_news_push_messages
from app.routers.notifications import update_push_device
from app.routers.news import create_news, delete_news, list_managed_news, list_news, update_news
from app.routers.users import update_user_role
from app.schemas import NewsCreate, NewsTranslationIn, PushDeviceUpdate, UserRoleUpdate


class ModeratorPermissionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        institution = Institution(slug="test", name="Test University")
        self.db.add(institution)
        self.db.flush()
        program = Program(
            institution_id=institution.id,
            slug="test-program",
            name="Test Program",
            duration_years=3,
        )
        self.db.add(program)
        self.db.flush()
        self.admin = self._user(program, "admin")
        self.moderator = self._user(program, "moderator")
        self.other_moderator = self._user(program, "moderator")
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _user(self, program, role):
        user = User(
            id=uuid.uuid4(),
            program_id=program.id,
            language="en",
            enrollment_year=2024,
            role=role,
        )
        self.db.add(user)
        self.db.flush()
        return user

    @staticmethod
    def _news_data(title="Test news"):
        return NewsCreate(
            is_published=True,
            translations=[NewsTranslationIn(lang="en", title=title, body="Details")],
        )

    def test_moderator_can_manage_only_news_they_authored(self):
        background_tasks = BackgroundTasks()
        created = create_news(
            self._news_data(), background_tasks, self.moderator, self.db
        )
        self.assertEqual(len(background_tasks.tasks), 1)
        stored = self.db.get(News, created.id)
        self.assertEqual(stored.author_id, self.moderator.id)
        self.assertEqual(created.created_at.utcoffset().total_seconds(), 0)

        managed = list_managed_news(self.moderator, self.db)
        self.assertEqual([item.id for item in managed], [created.id])

        updated = update_news(
            created.id,
            self._news_data("Updated by author"),
            BackgroundTasks(),
            self.moderator,
            self.db,
        )
        self.assertEqual(updated.translations[0].title, "Updated by author")

        with self.assertRaises(HTTPException) as update_error:
            update_news(
                created.id,
                self._news_data(),
                BackgroundTasks(),
                self.other_moderator,
                self.db,
            )
        self.assertEqual(update_error.exception.status_code, 404)

        with self.assertRaises(HTTPException) as delete_error:
            delete_news(created.id, self.other_moderator, self.db)
        self.assertEqual(delete_error.exception.status_code, 404)

        delete_news(created.id, self.moderator, self.db)
        self.assertIsNone(self.db.get(News, created.id))

    def test_admin_can_manage_all_news_and_grant_roles(self):
        created = create_news(
            self._news_data(), BackgroundTasks(), self.moderator, self.db
        )
        self.assertEqual(len(list_managed_news(self.admin, self.db)), 1)

        updated_user = update_user_role(
            self.other_moderator.id,
            UserRoleUpdate(role="student"),
            self.admin,
            self.db,
        )
        self.assertEqual(updated_user.role, "student")

        with self.assertRaises(HTTPException) as access_error:
            require_admin(self.moderator)
        self.assertEqual(access_error.exception.status_code, 403)
        self.assertIs(require_news_manager(self.moderator), self.moderator)

        delete_news(created.id, self.admin, self.db)

    def test_moderator_news_create_is_rate_limited(self):
        create_news(self._news_data("First"), BackgroundTasks(), self.moderator, self.db)
        with self.assertRaises(HTTPException) as error:
            create_news(self._news_data("Second"), BackgroundTasks(), self.moderator, self.db)
        self.assertEqual(error.exception.status_code, 429)
        self.assertEqual(error.exception.detail["code"], "cooldown")
        create_news(self._news_data("Admin first"), BackgroundTasks(), self.admin, self.db)
        create_news(self._news_data("Admin second"), BackgroundTasks(), self.admin, self.db)

    def test_only_admin_sees_news_author(self):
        create_news(self._news_data(), BackgroundTasks(), self.moderator, self.db)
        student = self._user(self.db.get(Program, self.moderator.program_id), "student")
        public = list_news(student, self.db)
        self.assertTrue(public)
        self.assertIsNone(public[0].author_id)
        as_admin = list_news(self.admin, self.db)
        self.assertEqual(as_admin[0].author_id, str(self.moderator.id))
        managed = list_managed_news(self.admin, self.db)
        self.assertEqual(managed[0].author_id, str(self.moderator.id))

    def test_last_admin_cannot_be_demoted(self):
        with self.assertRaises(HTTPException) as error:
            update_user_role(
                self.admin.id,
                UserRoleUpdate(role="moderator"),
                self.admin,
                self.db,
            )
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(
            self.db.scalar(select(User.role).where(User.id == self.admin.id)),
            "admin",
        )

    def test_push_device_can_be_registered_reassigned_and_disabled(self):
        token_value = f"ExponentPushToken[{uuid.uuid4().hex}]"
        response = update_push_device(
            PushDeviceUpdate(token=token_value, enabled=True),
            self.moderator,
            self.db,
        )
        self.assertEqual(response.status_code, 204)
        device = self.db.get(PushToken, token_value)
        self.assertEqual(device.user_id, self.moderator.id)
        self.assertTrue(device.enabled)

        update_push_device(
            PushDeviceUpdate(token=token_value, enabled=True),
            self.other_moderator,
            self.db,
        )
        self.assertEqual(device.user_id, self.other_moderator.id)

        update_push_device(
            PushDeviceUpdate(token=token_value, enabled=False),
            self.other_moderator,
            self.db,
        )
        self.assertFalse(device.enabled)

    def test_push_messages_match_news_audience_and_enabled_devices(self):
        matching_token = f"ExponentPushToken[{uuid.uuid4().hex}]"
        disabled_token = f"ExponentPushToken[{uuid.uuid4().hex}]"
        wrong_year_token = f"ExponentPushToken[{uuid.uuid4().hex}]"
        first_year_user = self._user(self.moderator.program, "student")
        first_year_user.enrollment_year = 2026
        self.db.add_all(
            [
                PushToken(token=matching_token, user_id=self.moderator.id, enabled=True),
                PushToken(token=disabled_token, user_id=self.other_moderator.id, enabled=False),
                PushToken(token=wrong_year_token, user_id=first_year_user.id, enabled=True),
            ]
        )
        news = News(
            is_published=True,
            institution_id=self.moderator.program.institution_id,
            program_id=self.moderator.program_id,
            year_min=3,
            year_max=3,
            translations=[
                NewsTranslation(
                    lang="en",
                    title="Targeted news",
                    excerpt="Targeted excerpt",
                    body="Details",
                )
            ],
        )
        self.db.add(news)
        self.db.flush()

        messages = build_news_push_messages(news, self.db)

        self.assertEqual([message["to"] for message in messages], [matching_token])
        self.assertEqual(messages[0]["title"], "Targeted news")
        self.assertEqual(messages[0]["data"]["newsId"], news.id)

    def test_expo_push_batch_payload_and_invalid_token_response(self):
        token_value = f"ExponentPushToken[{uuid.uuid4().hex}]"
        message = {"to": token_value, "title": "Test", "body": "Test body"}
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = json.dumps(
            {
                "data": [
                    {
                        "status": "error",
                        "message": "Device is not registered",
                        "details": {"error": "DeviceNotRegistered"},
                    }
                ]
            }
        ).encode("utf-8")

        with patch("app.push.urlopen", return_value=response) as urlopen:
            invalid_tokens = _send_batch([message])

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://exp.host/--/api/v2/push/send")
        self.assertEqual(json.loads(request.data.decode("utf-8")), [message])
        self.assertEqual(invalid_tokens, [token_value])



if __name__ == "__main__":
    unittest.main()
