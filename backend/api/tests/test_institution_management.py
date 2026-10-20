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
from app.models import Institution, News, Program, User
from app.main import app
from app.routers.institutions import (
    create_institution,
    create_program,
    delete_institution,
    delete_program,
)
from app.schemas import InstitutionCreate, ProgramCreate


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
