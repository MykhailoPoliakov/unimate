# UniMate Backend

This folder is the backend project root. It contains the API application in `api/` and the Compose/Caddy deployment setup alongside it.

## Structure

```text
backend/
├── api/                  FastAPI source, tests, Dockerfile, dependencies, and seed data
├── docker-compose.yml    PostgreSQL and API services
├── .env.example          Local/deployment environment template
├── Caddyfile             Example reverse-proxy configuration
├── DEPLOYMENT.md         Server setup and operations
└── commands.txt          Common development and deployment commands
```

## Local development

From the repository root, copy the template, set a strong `POSTGRES_PASSWORD` in `backend/.env`, and start PostgreSQL:

```powershell
Copy-Item backend\.env.example backend\.env
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d db
```

The database is bound to `127.0.0.1:5433`. Run the API from `api/` so Python loads `backend/.env`:

```powershell
Set-Location backend\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m app.seed
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`python -m app.seed` is destructive: it drops and recreates all application tables.

To run both the API and PostgreSQL in Docker, run this from the repository root:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d --build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for production operations.
