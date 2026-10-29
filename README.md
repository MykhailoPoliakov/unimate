# UniMate

UniMate is a mobile app that puts everything a student needs in one place: study links, social channels, and news from their institution.

Students pick their university, study program, and year once. UniMate then shows only what is relevant to them.

## What it does

- **Home** – quick-access buttons for the services of your university, such as the learning platform and student services, plus your personal timetable link.
- **News** – posts from your institution, targeted by university, program, and year. News can include images, links, and polls.
- **Socials** – community and social links for your university and program.
- **Notifications** – optional push notifications for new news.
- **Languages** – English, Dutch, German, French, Ukrainian, and Russian.
- **Privacy first** – no email or password sign-up. The app creates an anonymous profile, and you can delete it at any time from the menu.

## Who uses it

| Role | What they can do |
| --- | --- |
| Student | Reads news, links, and socials for their own university, program, and year. |
| Moderator | Publishes and manages news for their university. |
| Admin | Manages universities, programs, links, news, and user roles. |

## Repository layout

```text
frontend/   The mobile app (Expo and React Native; also runs on the web)
backend/    The API, database setup, and server deployment
docs/       Public website pages: privacy policy, terms, support, and about
```

## Getting started

Each part has its own guide with setup, commands, and configuration:

- **[Frontend guide](frontend/README.md)** – run the app on your phone, an emulator, or in the browser.
- **[Backend guide](backend/README.md)** – run the API and database locally, seed data, manage admins, and run tests.
- **[Deployment guide](backend/DEPLOYMENT.md)** – put the API on an Ubuntu server with HTTPS and backups.

In short: start the backend first, then the frontend, which connects to it.

## Website

The `docs/` folder is published with GitHub Pages and contains the app's legal and support pages. In the repository settings, deploy Pages from the `main` branch and the `/docs` folder.

## License

UniMate is released under the MIT license. See [LICENSE](LICENSE).
