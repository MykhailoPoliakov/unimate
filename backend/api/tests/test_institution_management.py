import os
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app.models import HomeButtonConfig, Institution, News, Program, User
from app.main import app
from app.routers.home_buttons import get_home_buttons, update_home_buttons
from app.routers.institutions import (
    create_institution,
    create_program,
    delete_institution,
    delete_program,
    update_institution,
    update_program,
)
from app.schemas import HomeButtonIn, HomeButtonsUpdate, InstitutionCreate, NameUpdate, ProgramCreate


class InstitutionManagementTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        institution = Institution(slug="test", name="Test University")
        self.db.add(institution)
        self.db.flush()
        self.institution = institution
        self.program = Program(
            institution_id=institution.id,
            slug="test-program",
            name="Test Program",
            duration_years=3,
        )
        self.db.add(self.program)
        self.db.flush()
        self.admin = User(
            program_id=self.program.id,
            language="en",
            enrollment_year=2024,
            role="admin",
        )
        self.db.add(self.admin)
        self.student = User(
            program_id=self.program.id,
            language="en",
            enrollment_year=2024,
            role="student",
        )
        self.db.add(self.student)
        self.db.commit()

        def override_db():
            yield self.db

        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_admin_can_create_university_and_program(self):
        created = create_institution(
            InstitutionCreate(slug="new-campus", name="New Campus"),
            self.admin,
            self.db,
        )
        program = create_program(
            created.slug,
            ProgramCreate(slug="design", name="Design", duration_years=4),
            self.admin,
            self.db,
        )

        self.assertEqual(created.slug, "new-campus")
        self.assertEqual(program.duration_years, 4)
        self.assertEqual(program.institution_id, created.id)

    def test_admin_can_rename_university_and_program(self):
        updated_institution = update_institution(
            self.institution.slug,
            NameUpdate(name="Renamed University"),
            self.admin,
            self.db,
        )
        updated_program = update_program(
            self.institution.slug,
            self.program.slug,
            NameUpdate(name="Renamed Program"),
            self.admin,
            self.db,
        )

        self.assertEqual(updated_institution.name, "Renamed University")
        self.assertEqual(updated_program.name, "Renamed Program")
        self.assertEqual(updated_program.slug, self.program.slug)

    def test_non_admin_cannot_create_university(self):
        response = self.client.post(
            "/institutions",
            headers={"X-User-Id": str(self.student.id)},
            json={"slug": "new-campus", "name": "New Campus"},
        )

        self.assertEqual(response.status_code, 403)

    def test_university_cannot_be_deleted_while_users_are_assigned(self):
        with self.assertRaises(HTTPException) as error:
            delete_institution(self.institution.slug, self.admin, self.db)

        self.assertEqual(error.exception.status_code, 409)

    def test_program_cannot_be_deleted_while_users_are_assigned(self):
        with self.assertRaises(HTTPException) as error:
            delete_program(
                self.institution.slug,
                self.program.slug,
                self.admin,
                self.db,
            )

        self.assertEqual(error.exception.status_code, 409)

    def test_admin_can_configure_home_buttons_for_their_university(self):
        initial = get_home_buttons(self.student, self.db)
        self.assertFalse(initial.configured)

        payload = HomeButtonsUpdate(
            buttons=[
                HomeButtonIn(
                    id="portal",
                    title="Student portal",
                    description="Open the student portal",
                    url="https://example.edu/portal",
                    color="#123456",
                )
            ]
        )

        result = update_home_buttons(payload, self.admin, self.db)
        loaded = get_home_buttons(self.student, self.db)

        self.assertTrue(result.configured)
        self.assertEqual(loaded.buttons[0].id, "portal")
        self.assertEqual(loaded.buttons[0].url, "https://example.edu/portal")

        empty = update_home_buttons(HomeButtonsUpdate(buttons=[]), self.admin, self.db)
        self.assertTrue(empty.configured)
        self.assertEqual(empty.buttons, [])
        self.assertIsNotNone(self.db.get(HomeButtonConfig, self.institution.id))

    def test_non_admin_cannot_update_home_buttons(self):
        response = self.client.put(
            "/home-buttons",
            headers={"X-User-Id": str(self.student.id)},
            json={"buttons": []},
        )

        self.assertEqual(response.status_code, 403)

    def test_home_button_urls_and_schedule_type_are_validated(self):
        with self.assertRaises(ValueError):
            HomeButtonIn(
                id="unsafe",
                title="Unsafe URL",
                url="javascript:alert(1)",
            )

        schedule = HomeButtonsUpdate(
            buttons=[
                HomeButtonIn(
                    id="schedule",
                    title="Schedule",
                    url="https://timeedit.example/",
                    platform="schedule",
                )
            ]
        )
        with self.assertRaises(HTTPException) as error:
            update_home_buttons(schedule, self.admin, self.db)

        self.assertEqual(error.exception.status_code, 422)

    def test_home_button_description_is_limited_to_100_characters(self):
        button = HomeButtonIn(
            id="portal",
            title="Student portal",
            url="https://example.edu/portal",
            description="x" * 100,
        )
        self.assertEqual(len(button.description), 100)

        with self.assertRaises(ValueError):
            HomeButtonIn(
                id="portal",
                title="Student portal",
                url="https://example.edu/portal",
                description="x" * 101,
            )

    def test_program_cannot_be_deleted_while_content_targets_it(self):
        self.db.add(
            News(
                institution_id=self.institution.id,
                program_slugs='["test-program"]',
                year_list="[1]",
            )
        )
        self.db.commit()

        with self.assertRaises(HTTPException) as error:
            delete_program(
                self.institution.slug,
                self.program.slug,
                self.admin,
                self.db,
            )

        self.assertEqual(error.exception.status_code, 409)

    def test_unreferenced_university_and_its_programs_can_be_deleted(self):
        self.db.delete(self.admin)
        self.db.delete(self.student)
        self.db.commit()

        delete_institution(self.institution.slug, self.admin, self.db)

        self.assertIsNone(self.db.get(Institution, self.institution.id))
        self.assertIsNone(self.db.get(Program, self.program.id))


if __name__ == "__main__":
    unittest.main()
