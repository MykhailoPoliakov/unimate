# UniMate

UniMate is a student-focused mobile app for finding institution resources, course links, and student news in one place. Students choose their institution and study program to see relevant buttons, social links, and news. Admins can manage links and publish posts with polls.

## Features

- Institution, program, and year-based student profiles
- Institution-specific resource buttons and social links
- News feed with audience targeting, images, and polls
- Admin tools for managing social links and news
- Expo app for Android, iOS, and web

## Project Structure

```text
backend/   FastAPI API, PostgreSQL database setup, and seed data
frontend/  Expo and React Native app
```

The backend serves the API on port `8000`. The frontend calls it using `EXPO_PUBLIC_API_URL`, or detects the Expo host for native development. The API's interactive documentation is available at `/docs` while the backend is running.

## Requirements

- Python
- Docker Engine and Docker Compose, or a local PostgreSQL 17 server
- Node.js and npm
- For Android testing: Android Studio with an emulator, or an Android device with Expo Go/development build

## Run Locally

Start PostgreSQL from the repository root. Copy `.env.example` to `.env`, set a strong `POSTGRES_PASSWORD`, then run:

```sh
docker compose up -d db
```

Create and activate a Python environment in `backend/`, then install dependencies:

```powershell
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS/Linux: use this instead
# source .venv/bin/activate

python -m pip install -r requirements.txt
```

From `backend/`, the backend reads the repository-root `.env` automatically. Seed the database once, then start the API:

```powershell
# Seed (destructive: drops and recreates all tables)
python -m app.seed

# Start the backend (run this in its own terminal)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is at `http://127.0.0.1:8000`; check `http://127.0.0.1:8000/health` or open `http://127.0.0.1:8000/docs`.

In a second terminal, start the frontend:

```powershell
cd frontend
npm install
npx expo start
```

Use the Expo terminal options to open the app in an Android emulator, on a device, in an iOS simulator, or in a web browser. The frontend also has `npm run android`, `npm run ios`, and `npm run web` scripts.

### Android Device Setup

For a physical Android device, the phone and development computer must be able to reach each other over the network. If the app cannot connect to the API, create `frontend/.env` based on `frontend/.env.example` and set the computer's LAN address:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

Replace `192.168.1.10` with the computer's actual LAN IP. Keep the backend bound to `0.0.0.0` as in the command above, and allow the port through the computer's firewall if needed. On web, the default API URL is `http://127.0.0.1:8000`.

## Database and Admins

The backend requires a PostgreSQL connection in `DATABASE_URL`. `python -m app.seed` creates the tables and loads institutions, buttons, and social links from `backend/seed-data.json`. News starts empty.

**Seeding resets the configured database.** It deletes all existing tables and data, including users, news, and poll votes, before creating and filling it again. Stop the backend before reseeding. The Ubuntu Docker deployment steps, HTTPS setup, and first-time seed command are in [DEPLOYMENT.md](DEPLOYMENT.md).

Backend tests require a dedicated PostgreSQL database because they drop and recreate their tables. From the repository root, create it once, then run the tests from `backend/`:

```powershell
docker compose exec db createdb -U unimate unimate_test
cd backend
$env:TEST_DATABASE_URL = "postgresql+psycopg://unimate:YOUR_HEX_PASSWORD@127.0.0.1:5433/unimate_test"
python -m unittest discover -s tests
```

Replace the password with the local `.env` value. On macOS/Linux, use `export TEST_DATABASE_URL='postgresql+psycopg://unimate:YOUR_HEX_PASSWORD@127.0.0.1:5433/unimate_test'`. Never point `TEST_DATABASE_URL` at a production database.

From `backend/`, add an admin with one command using that user's ID:

```powershell
python -m app.admin grant USER_ID
```

To find the user ID or manage roles, use:

```powershell
python -m app.admin list
python -m app.admin revoke USER_ID
```

## Icons and Images

Bundled service and institution icons live in `frontend/assets/images/icons/`. `frontend/src/lib/local-icons.js` maps icon keys to those local image files; the app displays a matching image or falls back to an icon glyph. The API stores the icon key for links, not the PNG itself. App launcher and splash images are configured separately in `frontend/app.json`.

News photos use a different path: the admin picker sends the selected image as a data URL in the news content. This project does not currently use a separate image-hosting service.

## Push Notifications

Remote push requires an EAS project ID, APNs credentials for iOS, FCM credentials for Android, and a native development or production build. From `frontend/`, run `npx eas-cli@latest init` to link or create the EAS project, then use its project UUID for `EXPO_PUBLIC_EAS_PROJECT_ID` in your local `.env` or EAS build environment. Configure APNs and FCM credentials with EAS and rebuild the native app. Android remote push is not available in Expo Go; use a development build. Devices register when the Push notifications setting is enabled, and the backend sends to enabled devices whose profiles match the news audience. If Expo push security is enabled, configure `EXPO_ACCESS_TOKEN` for the backend.

## Licensing

UniMate source is licensed under MIT; see `LICENSE`. The Expo MIT notice is kept separately in `THIRD-PARTY-LICENSES/EXPO-MIT.txt` and applies to Expo-authored material, not the UniMate project.

## Push Notifications

Remote push requires an EAS project ID, APNs credentials for iOS, FCM credentials for Android, and a native development or production build. Set `EXPO_PUBLIC_EAS_PROJECT_ID` from `frontend/.env.example` (or configure it in the EAS build environment) and configure push credentials with EAS. Android remote push is not available in Expo Go; use a development build. The backend sends news pushes only to devices with push enabled whose profiles match the news audience. The in-app unread badge works independently of push.
