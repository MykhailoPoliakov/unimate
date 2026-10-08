# UniMate

UniMate is a student-focused mobile app for finding institution resources, course links, and student news. Students choose their institution and study program to see relevant buttons, social links, and news. Admins can manage links and publish posts with polls.

## Project structure

```text
backend/    Backend project: API source, database setup, and deployment
  api/      FastAPI application, tests, dependencies, and seed data
frontend/   Expo and React Native app
docs/       Static legal, support, and about pages published with GitHub Pages
README.md   Project overview and quick start
LICENSE     UniMate license
```

The backend project has its own [README](backend/README.md) and [deployment guide](backend/DEPLOYMENT.md). Frontend setup details are in [frontend/README.md](frontend/README.md).

GitHub Pages serves the static site from the repository's root `docs/` folder. Configure Pages in the repository settings to deploy from the `main` branch and `/docs` folder.

## Requirements

- Docker Engine and Docker Compose
- Python 3.12 for running the API or tests locally
- Node.js and npm
- For Android testing: Android Studio with an emulator, or an Android device with Expo Go/development build

## Quick start

From the repository root, create `backend/.env`, set a strong `POSTGRES_PASSWORD`, then start PostgreSQL:

```powershell
Copy-Item backend\.env.example backend\.env
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d db
```

The database is available to local development on `127.0.0.1:5433`; Compose only binds it to loopback. To run the API locally, create a Python environment in `backend/api/`, install its requirements, then seed a new database once and start the server:

```powershell
Set-Location backend\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

# Destructive: drops and recreates all application tables.
python -m app.seed
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is at `http://127.0.0.1:8000`; its health check is `/health` and interactive docs are at `/docs`.

In a second terminal, start the frontend:

```powershell
Set-Location frontend
npm install
npx expo start
```

The app detects the Expo host for native development, or uses `EXPO_PUBLIC_API_URL` when set. For a physical Android device, create `frontend/.env` from `frontend/.env.example` and set the computer's LAN address, for example `http://192.168.1.10:8000`.

To run the API in Docker instead of locally:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d --build
```

The container API is published on `127.0.0.1:8001`. For Ubuntu deployment, HTTPS, backups, and operations, follow [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md).

## Database and administration

The API loads initial institutions, buttons, and social links from `backend/api/seed-data.json`. Seeding **drops and recreates all application tables**, deleting users, news, and poll votes; only seed an empty database or when you deliberately intend to reset it.

Backend tests require a dedicated PostgreSQL test database because they drop and recreate their tables. Start PostgreSQL using the quick-start command, then:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml exec db createdb -U unimate unimate_test
Set-Location backend\api
$env:TEST_DATABASE_URL = "postgresql+psycopg://unimate:YOUR_PASSWORD@127.0.0.1:5433/unimate_test"
python -m unittest discover -s tests
```

Use the local `POSTGRES_PASSWORD` in the test URL, URL-encoding it if needed. Never point `TEST_DATABASE_URL` at production.

From `backend/api/`, grant an existing user admin access with `python -m app.admin grant USER_ID`; use `python -m app.admin list` to view users and roles or `python -m app.admin revoke USER_ID` to revoke access.

## Licensing

UniMate source is licensed under MIT; see [LICENSE](LICENSE). The Expo MIT notice is in [frontend/THIRD-PARTY-LICENSES/](frontend/THIRD-PARTY-LICENSES/) and applies to Expo-authored material.
