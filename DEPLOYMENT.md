# Ubuntu Server Deployment and Operations

This guide runs the UniMate FastAPI backend and PostgreSQL in Docker Compose, with Caddy installed on Ubuntu providing public HTTPS. The frontend is a separate Expo mobile app and is built for users' phones; it is not served by this backend deployment.

The Compose services are named `backend` and `db`. PostgreSQL has no public port, and the backend is published only on `127.0.0.1:8001`; Caddy proxies requests from ports 80 and 443 to it. Run Compose commands from the repository root, where `docker-compose.yml` and `.env` are located. Use `sudo` with Docker unless you intentionally configure Docker access for your account. Membership in the `docker` group grants root-equivalent access.

## Current deployment: finish setup

If Docker Compose has already started `db` and `backend` and the database has already been seeded, **do not seed again**. Follow these steps to finish HTTPS and verify the deployment.

### 1. Check DNS and the API

Make sure the A record for the API hostname (for example, `api.unimate.be`) points to this server's public IPv4 address. Only create an AAAA record if the server is reachable at that public IPv6 address. Check DNS and the backend from the server:

```bash
getent ahostsv4 api.unimate.be
curl -fsS http://127.0.0.1:8001/health
sudo docker compose ps
```

The health endpoint should return `{"status":"ok"}`, and `db` should be healthy. Replace `api.unimate.be` in commands and configuration below if using another hostname. Ports 80 and 443 must be allowed by both UFW and the hosting provider's firewall; SSH must remain allowed.

### 2. Rotate the database password if it has been shared

If the current database password was posted in chat, email, a screenshot, or another shared place, treat it as compromised and replace it. Changing `.env` alone does **not** change the password inside an already-initialized PostgreSQL volume.

Generate a fresh password:

```bash
openssl rand -hex 32
```

Copy it privately. First update `POSTGRES_PASSWORD` in `.env` to the new value and save the file. Then change the password stored in the running database; `\password` prompts without echoing the value:

```bash
sudo docker compose exec db psql -U unimate -d unimate
```

At the `psql` prompt, enter:

```text
\password unimate
```

Enter the same new password twice, then exit with `\q`. Recreate the backend container so it reads the updated `.env`:

```bash
sudo docker compose up -d --force-recreate backend
sudo docker compose ps
curl -fsS http://127.0.0.1:8001/health
```

If the database role or database has a different name, use the values of `POSTGRES_USER` and `POSTGRES_DB` in `.env`. If the password has already been rotated this way, do not repeat these steps.

Protect `.env` and keep it out of version control:

```bash
chmod 600 .env
git status --short
```

Never paste `.env`, database passwords, or unredacted `docker compose config` output into chat or public logs.

### 3. Install and configure Caddy for HTTPS

Install Caddy using its official [Debian/Ubuntu instructions](https://caddyserver.com/docs/install#debian-ubuntu-raspbian). The repository [Caddyfile](Caddyfile) is an example; replace `api.example.com` with your real hostname before using it. The system service does not automatically read the project's `.env`. Create `/etc/caddy/Caddyfile` with the real hostname:

```caddyfile
api.unimate.be {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8001
}
```

Then validate, reload, and test:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl --fail https://api.unimate.be/health
```

Caddy obtains and renews HTTPS certificates automatically when DNS resolves to this server and the internet can reach ports 80 and 443. If HTTPS fails, check the DNS record, both firewalls, and Caddy logs:

```bash
sudo journalctl -u caddy -n 100 --no-pager
```

The API docs are available at `https://api.unimate.be/docs`. The current API's client-supplied `X-User-Id` identity is not secure authentication; do not expose real users' private data or admin operations publicly until proper authentication and authorization have been implemented.

### 4. Configure the mobile app

Set `EXPO_PUBLIC_API_URL` to `https://api.unimate.be` in the Expo/EAS production environment **before** building the mobile app. The value is compiled into the app; changing the server's `.env` does not update an existing mobile build. Never use `localhost`, `127.0.0.1`, or port `8001` in a production mobile build.

From `frontend/`, configure EAS if it is not already configured, then build:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile production --environment production
```

For iOS, use `--platform ios` and test the resulting build with TestFlight. Configure the app identifiers in `frontend/app.json` and the production API URL in the EAS production environment. Store publication also requires the corresponding Apple or Google developer account and store review setup.

## First-time deployment reference

Use this section only when setting up a new server and empty database. If the database was already seeded, skip the seed step; it is destructive.

1. Point the API hostname's DNS A record to the server's public IPv4 address. Only add an AAAA record if public IPv6 is configured and working.
2. Allow SSH, TCP 80, and TCP 443 in UFW and in the hosting provider's firewall. Do not expose PostgreSQL or backend port 8001 publicly.
3. Install Docker Engine and Compose from Docker's official Ubuntu apt repository, then enable Docker:

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

4. Clone the repository and configure secrets:

   ```bash
   git clone <your-repository-url> unimate
   cd unimate
   cp .env.example .env
   openssl rand -hex 32
   nano .env
   chmod 600 .env
   ```

   Put the generated password in `POSTGRES_PASSWORD` and the API hostname in `DOMAIN`. Keep the generated password private. `WEB_CONCURRENCY` is set to `1` by Compose for the API container; this is suitable as a conservative starting point for a 1-vCPU, 1-GB server.

5. Validate without printing resolved secrets, build the backend, and start PostgreSQL:

   ```bash
   sudo docker compose config --quiet
   sudo docker compose build backend
   sudo docker compose up -d db
   sudo docker compose ps
   ```

   Wait until `db` reports healthy before proceeding. If it does not, inspect `sudo docker compose logs --tail=100 db`.

6. Seed a new, empty database once:

   ```bash
   sudo docker compose run --rm backend python -m app.seed
   ```

   **Seeding drops and recreates application tables and deletes app data**, including users, news, and poll votes. Never run this for normal starts, updates, or troubleshooting.

7. Start and check the backend:

   ```bash
   sudo docker compose up -d backend
   sudo docker compose ps
   curl -fsS http://127.0.0.1:8001/health
   ```

8. Install and configure Caddy as described in “Install and configure Caddy for HTTPS” above. Then set the mobile app's production API URL and build it as described above.

## Day-to-day management

Run these commands from `~/unimate`:

```bash
# Show service state (db should be healthy)
sudo docker compose ps

# Follow logs; Ctrl+C stops following, not the services
sudo docker compose logs -f backend
sudo docker compose logs -f db

# Restart one service
sudo docker compose restart backend
sudo docker compose restart db

# Stop containers but retain database files
sudo docker compose down

# Start existing services again
sudo docker compose up -d
```

To check the API externally, use `curl -fsS https://api.unimate.be/health` from a machine with network access. Replace the example hostname with yours. The backend's local-only port can also be checked on the server using `curl -fsS http://127.0.0.1:8001/health`.

### Update application code

Before updating, make a database backup using the instructions below. Then, from the repository root:

```bash
git pull
sudo docker compose build backend
sudo docker compose up -d backend
sudo docker compose ps
curl -fsS https://api.unimate.be/health
```

Routine code updates do not need a database seed or volume removal. If a change specifically requires a schema migration, follow that change's migration instructions; do not run the destructive seed as a substitute.

### Manage admin accounts

From the server:

```bash
sudo docker compose exec backend python -m app.admin list
sudo docker compose exec backend python -m app.admin grant USER_ID
sudo docker compose exec backend python -m app.admin revoke USER_ID
```

Replace `USER_ID` with the user's ID. Grant admin access only to trusted accounts. This app's current identity mechanism is not safe for public admin access until real authentication is implemented.

## Database backups and restore

Store backups outside the repository, restrict access, and copy them off the server. A backup on the same server will not protect against server or disk loss:

```bash
mkdir -p "$HOME/unimate-backups"
chmod 700 "$HOME/unimate-backups"
umask 077
sudo docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$HOME/unimate-backups/unimate-$(date +%F-%H%M%S).sql"
```

Verify that the backup file is non-empty and arrange encrypted off-server storage. Periodically test restoring into a separate, disposable database.

Restoring replaces the current database contents. Only do this deliberately after preserving a current backup. The commands below **delete and recreate the configured database** before restoring; replace the path with the exact backup to restore:

```bash
sudo docker compose stop backend
sudo docker compose exec db sh -c 'dropdb --if-exists -U "$POSTGRES_USER" --maintenance-db=postgres "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"'
sudo docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < "$HOME/unimate-backups/backup-to-restore.sql"
sudo docker compose start backend
```

If the restore command fails, keep the backend stopped and resolve the restore error before restarting it. Do not use `docker compose down -v` to troubleshoot: it deletes the persistent database volume.

## Security and capacity notes

- Keep ports 5432 and 8001 private. Compose binds the API port to loopback for host-installed Caddy, while the database has no published port.
- `.env` contains the database password. Keep it private, use strong unique secrets, and rotate any secret that has been shared.
- Docker-published ports can bypass assumptions about UFW filtering; the loopback bind is intentional.
- The current API trusts a client-provided `X-User-Id` header as identity. It is not proof of identity and may permit impersonation. Implement verified authentication and authorization before public use with real user data or admin actions.
- This is a single small server, not a highly available deployment. Monitor disk space, memory, logs, and backups. The Compose configuration uses one API worker to limit memory use on a 1-GB server.
