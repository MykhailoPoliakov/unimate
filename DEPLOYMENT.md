# Ubuntu Server Deployment

This deploys the FastAPI backend, PostgreSQL, and Caddy with automatic HTTPS. The API and PostgreSQL are not publicly exposed; the PostgreSQL port is bound to server loopback for local administration and testing. Public traffic enters through Caddy on ports 80 and 443. A single Ubuntu server is a sensible starting point, not a highly available or automatically scaling cluster.

## 1. Prepare DNS and Firewall

Choose a domain or subdomain for the API, for example `api.example.com`, and point its DNS A record at the server's public IPv4 address. Only add an AAAA record if the server is reachable over IPv6. Caddy needs the domain to resolve publicly and inbound ports 80 and 443 to be open to issue and renew HTTPS certificates.

Allow SSH before enabling UFW so you do not lock yourself out. Also open ports 80 and 443 in your hosting provider's firewall/security group:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 2. Install Docker Engine and Compose

On a supported Ubuntu release, install Docker from its official apt repository:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

Run Compose commands with `sudo` unless you deliberately configure Docker access for your user. Membership in the `docker` group grants root-equivalent access.

## 3. Get the Project and Set Secrets

Clone the repository using its actual URL, then work from its root (the directory containing `docker-compose.yml`):

```bash
git clone <your-repository-url> unimate
cd unimate
cp .env.example .env
openssl rand -hex 32
nano .env
chmod 600 .env
```

Copy the output of `openssl rand -hex 32` into `POSTGRES_PASSWORD`. Keep it hexadecimal as generated; this makes it safe to use in the Compose database URL. Set `DOMAIN` to the DNS name from step 1. Do not commit `.env` or share it in screenshots/logs.

## 4. Start PostgreSQL and Initialize the Empty Database

Build the backend image and start PostgreSQL. Wait for it to become healthy:

```bash
sudo docker compose build api
sudo docker compose up -d db
sudo docker compose ps
```

Initialize schema and bundled institution/button/social data:

```bash
sudo docker compose run --rm api python -m app.seed
```

**This command is destructive:** it drops and recreates every application table, deleting all users, news, votes, and other database content. Run it once for this fresh deployment. Do not run it as part of normal updates or restarts.

Start the API and HTTPS proxy:

```bash
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 api proxy
curl --fail https://<your-api-domain>/health
```

Replace `<your-api-domain>` with the same domain set in `.env`. A successful health check returns `{"status":"ok"}`. The interactive API docs are at `https://<your-api-domain>/docs`; consider disabling public docs for a hardened production deployment.

## 5. Point the Mobile App at the API

Set `EXPO_PUBLIC_API_URL` to `https://<your-api-domain>` in the Expo project's production environment variables before building. This value is compiled into the app; changing the server's `.env` does not change an already-published mobile app. Never use `localhost` or the server's port 8000 in a store build.

From `frontend/`, link/configure the Expo project and build using the production environment:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform ios --profile production --environment production
```

Configure the iOS bundle identifier and Android package name in `frontend/app.json`, and set the production API URL in the Expo dashboard's environment variables. Test the resulting iOS build with TestFlight before submitting it to App Store Connect. Store submission also requires Apple Developer enrollment, app privacy disclosures, support/contact details, screenshots, and review compliance. For Android, use `--platform android` and complete the Google Play Console setup. Push notifications additionally require the APNs/FCM credentials described in the main README.

## 6. Updates, Logs, and Backups

Routine backend updates do not reseed the database:

```bash
git pull
sudo docker compose up -d --build
sudo docker compose ps
```

Inspect logs with `sudo docker compose logs -f api` and `sudo docker compose logs -f db`. Back up PostgreSQL regularly and copy backups off the server:

```bash
sudo docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "unimate-$(date +%F).sql"
```

Test restore procedures before relying on backups. The named `postgres_data` volume survives container replacement. **Do not use `docker compose down -v`** unless you intentionally want to permanently delete the database volume. A volume on the same server is not a backup.

## Capacity and Production Readiness

`WEB_CONCURRENCY=2` starts two API worker processes by default. Adjust it to available CPU/RAM and load-test the real workload; each worker can hold database connections, so size PostgreSQL's connection limit accordingly. One VPS has a single failure domain. As traffic grows, measure database latency, CPU, memory, and request latency first; then consider a managed PostgreSQL service, object storage/CDN for news images, and a durable task queue for push notifications. Keep database backups and test recovery before increasing capacity.

**Authentication must be fixed before a public release.** The current API trusts a client-provided `X-User-Id` header as identity. It is not proof of identity and can allow impersonation; roles and admin operations therefore are not adequately protected for an App Store audience. Add a real authentication system (for example, a verified identity provider with signed access tokens) and authorize each request from the verified token before launch. PostgreSQL and more workers do not address this security issue.
