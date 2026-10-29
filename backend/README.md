# UniMate Backend

The backend is a FastAPI application backed by PostgreSQL. This folder holds the API, the Docker Compose setup, and the server deployment files.

## Structure

```text
backend/
├── api/                  FastAPI app, tests, Dockerfile, requirements, seed data
├── ops/                  `unimate` helper command and its Bash completions
├── docker-compose.yml    PostgreSQL and API services
├── .env.example          Environment template
├── Caddyfile             Example reverse-proxy configuration for HTTPS
├── DEPLOYMENT.md         Server setup and operations
├── commands.txt          Quick command reference
├── demo_university.py    Creates a fictional university for App Store screenshots
└── README.md             This file
```

## Requirements

- Docker Engine and Docker Compose
- Python 3.12 to run the API or tests outside Docker

## Configuration

Create `backend/.env` from the template and set a strong `POSTGRES_PASSWORD`:

```powershell
Copy-Item backend\.env.example backend\.env
```

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database name, user, and password. |
| `DOMAIN` | Public API domain, used by the Caddy deployment. |
| `WEB_CONCURRENCY` | Number of API worker processes. |
| `DATABASE_URL` | Optional. Overrides the URL built from the `POSTGRES_*` values. |

## Local development

Run these from the repository root. First start PostgreSQL:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d db
```

The database listens on `127.0.0.1:5433` only. Then run the API from `backend/api/`, so Python can find `backend/.env`:

```powershell
Set-Location backend\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

# Destructive: drops and recreates all application tables.
python -m app.seed
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

The API is at `http://127.0.0.1:8001`. The health check is `/health` and interactive docs are at `/docs`.

Port 8001 matches what the frontend uses by default. If you use another port, set `EXPO_PUBLIC_API_URL` in the frontend (see the [frontend guide](../frontend/README.md)).

To run both the API and the database in Docker instead, run this from the repository root. The API is then published on `127.0.0.1:8001`:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d --build
```

## Database and seed data

`api/seed-data.json` holds the initial institutions, buttons, and social links. `python -m app.seed` loads it, but it **drops and recreates all application tables**. That deletes users, news, and poll votes, so only run it on an empty database or when you deliberately want a reset.

Open a database shell with:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml exec db psql -U unimate -d unimate
```

## Administration

From `backend/api/`, manage admin access by user ID:

```powershell
python -m app.admin list
python -m app.admin grant USER_ID
python -m app.admin revoke USER_ID
```

A user's ID is shown at the bottom of the app's Menu. Moderators are assigned a scope by an admin in the app.

## Tests

The tests drop and recreate their tables, so they need a dedicated PostgreSQL test database. Never point them at production.

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml exec db createdb -U unimate unimate_test
Set-Location backend\api
$env:TEST_DATABASE_URL = "postgresql+psycopg://unimate:PASSWORD@127.0.0.1:5433/unimate_test"
python -m unittest discover -s tests
```

Replace `PASSWORD` with your local `POSTGRES_PASSWORD`, URL-encoded if it contains special characters.

## Helper command: `unimate`

`ops/unimate` wraps the common Docker and admin tasks. Install it once in Bash, from the repository root:

```bash
source backend/ops/install.sh
```

After that it works from any directory:

```bash
unimate start            # start containers
unimate stop             # stop containers
unimate status           # show container state
unimate logs backend     # follow logs; use "db" for the database
unimate update           # git pull, rebuild the API, wait until healthy
unimate list             # list accounts
unimate grant USER_ID    # make a user admin
unimate revoke USER_ID   # remove admin access
unimate seed             # destructive reset, asks for confirmation
unimate backup           # write a database dump to ~/unimate-backups/
unimate help
```

It uses `sudo docker compose` and `git pull --ff-only`, and finds the repository relative to its own location.

## Demo data for screenshots

`demo_university.py` adds or removes a fictional university through the admin API:

```powershell
python backend\demo_university.py API_URL ADMIN_USER_ID
python backend\demo_university.py API_URL ADMIN_USER_ID --remove
```

## Deployment

For Ubuntu setup, HTTPS with Caddy, updates, backups, and recovery, see [DEPLOYMENT.md](DEPLOYMENT.md). The API listens on `127.0.0.1:8001` and should only be exposed through Caddy, never directly.
