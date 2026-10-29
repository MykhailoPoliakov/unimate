# UniMate Frontend

The frontend is an [Expo Router](https://docs.expo.dev/router/introduction/) app for iOS, Android, and web, styled with NativeWind.

## Requirements

- Node.js and npm
- A running API, see the [backend guide](../backend/README.md)
- For native testing: Expo Go or a development build on a device, or an Android/iOS emulator

## Setup

From this directory:

```sh
npm install
```

## Configure the API address

The app picks its API address in this order:

1. `EXPO_PUBLIC_API_URL`, when set.
2. The Expo dev host on port `8001`, for native development.
3. `http://127.0.0.1:8001`.

Port 8001 is where the backend runs in Docker and in the local setup from the backend guide. To use another address, such as a physical device on your local network, create `frontend/.env` from the template and edit it:

```sh
cp .env.example .env  
```

```text
EXPO_PUBLIC_API_URL=http://192.168.1.10:8001
EXPO_PUBLIC_EAS_PROJECT_ID=<your Expo project id>
```

`EXPO_PUBLIC_EAS_PROJECT_ID` is used to register Expo push tokens. Restart Expo after changing `.env`.

## Run

```sh
npm start            # Expo dev server
npm run web          # web, on http://localhost:5173
npm run ios          # native iOS build
npm run android      # native Android build
npm run lint         # ESLint via Expo
```

## Structure

- `src/app/` – file-based routes: `index` (Home), `news`, `socials`, and `settings`, including its legal pages.
- `src/components/` – shared UI such as tabs, news cards, settings rows, and legal-document layout.
- `src/hooks/` – profile, news feed, theme, notification, and localization state.
- `src/lib/` – the API client, device helpers, and domain utilities.
- `src/i18n/` – all user-facing translations. Legal copy lives here too so it stays localized.
- `src/constants/` – theme colors and the built-in study catalog.
- `assets/` – app imagery and bundled institution and service icons.

## Notes

- The profile is anonymous. The app stores a user ID on the device and sends it to the API in the `X-User-Id` header.
- Moderators and admins see extra controls in News. Posts outside their own university, program, or year are shown with a red background.
- The public legal and support pages live in the repository-root [`docs/`](../docs/) folder, not in the app.

## License

The source is MIT-licensed. See the repository-root [`LICENSE`](../LICENSE).
