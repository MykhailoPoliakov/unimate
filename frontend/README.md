# UniMate Frontend

The frontend is an Expo Router app for iOS, Android, and web. See the [repository README](../README.md) for setup, API configuration, and database instructions.

## Structure

- `src/app/` contains file-based routes, including Settings and its legal pages.
- `src/components/` contains shared UI such as tabs, settings rows, and legal-document layout.
- `src/hooks/` contains profile, feed, theme, notification, and localization state.
- `src/lib/` contains API clients, device helpers, and domain utilities.
- `src/i18n/` contains user-facing translations; legal copy belongs here so it stays localized.
- `assets/` contains app imagery and bundled institution/service icons.

## Run

From this directory:

```sh
npm install
npm run web
```

Use `npm run ios` or `npm run android` for native development targets.

## Licensing

UniMate source is licensed under MIT in the repository-root [`LICENSE`](../LICENSE). Expo's MIT notice is separate at `../THIRD-PARTY-LICENSES/EXPO-MIT.txt` and applies to Expo-authored material.
