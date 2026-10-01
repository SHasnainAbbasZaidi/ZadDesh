# Self-hosting ZadDesh

[Overview](../README.md) · [User guide](USER_GUIDE.md)

## Choose a deployment

Use Node.js 24 with npm on Windows, Linux, or macOS, or Docker with Compose v2. The server needs a persistent process and writable local storage. SQLite is the supported database: use one application instance and local disk, not a shared network filesystem. Static hosting and GitHub Pages cannot run the backend. Docker and cross-platform production deployment still need validation in your environment.

The recommended network path is browser → HTTPS reverse proxy → HTTP backend on loopback port 8443 → SQLite. Native remote clients connect from the user's computer. TCP probes and browser SSH connect from the ZadDesh server. Configure firewalls accordingly. Serve ZadDesh at the root of its own origin, rather than under a URL subdirectory.

## Install with Node

```sh
git clone https://github.com/SHasnainAbbasZaidi/ZadDesh.git
cd ZadDesh
npm ci
```

Copy `.env.example` to `.env` using `Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` on Linux/macOS. Private repositories require GitHub access.

Generate a persistent secret:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Put the output in `VAULT_SECRET`. Never commit `.env` or regenerate this secret on each restart. Keep a separate protected recovery copy.

For a local preview, retain `HOST=127.0.0.1`, `APP_ORIGIN=http://localhost:8443`, and `FORCE_HTTPS=false`.

```sh
npm run build
npm start
```

Open http://localhost:8443. The default port serves HTTP, despite its number. The `dev` script also runs the server; rebuild the frontend after source changes.

On a fresh database, the console prints the temporary password for `admin` once. Change it at first login. Keep startup logs private. `INITIAL_ADMIN_PASSWORD` only controls initial creation; changing it later does not reset an existing account.

## Production with Docker Compose

Install Docker and Compose v2 for your platform. Use the repository's Dockerfile and Compose configuration. Copy `.env.example` to `.env`, generate `VAULT_SECRET` as above, and set:

```dotenv
APP_ORIGIN=https://zaddesh.example.com
PORT=8443
FORCE_HTTPS=true
TRUST_PROXY=1
```

Replace the example domain with your real domain. Add a separate random `BACKUP_PASSWORD` of at least 16 characters. If Node is unavailable locally, generate a secret using:

```sh
docker run --rm node:24-bookworm-slim node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Configure the same-host HTTPS proxy described below, then start:

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 zaddesh
```

Compose enforces production mode, HTTPS, one trusted proxy hop, internal port 8443, and `/app/data`. The host port is bound to `127.0.0.1`. The container runs as a non-root user with a read-only root filesystem, temporary `/tmp`, dropped capabilities, and persistent data and backup volumes.

Compose prefixes named volumes with its project name. Keep the project name stable during upgrades. Do not run `docker compose down -v` unless you intentionally want to delete persisted data. Changing `PORT` changes the published host port; update the proxy upstream too.

## HTTPS with Caddy or Nginx

Use a trusted certificate and an exact `APP_ORIGIN` matching the URL users visit. For a public domain, configure DNS to point at your server. Default public certificate issuance needs the appropriate inbound ports, normally 80 and 443. Private deployments need a certificate trusted by every client or a suitable domain-validation arrangement.

For Caddy running on the same host, merge this into its configuration:

```caddyfile
zaddesh.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8443
}
```

The included [Caddy example](../deploy/Caddyfile) uses this arrangement. Validate configuration before reloading your installed Caddy service. Preserve Caddy's certificate storage.

Alternatively, adapt [the Nginx example](../deploy/nginx.conf). Obtain certificates first and replace the example domain and certificate paths. It forwards WebSocket upgrades needed for browser SSH. On a conventional Linux service installation:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

For direct Node production, set `NODE_ENV=production`, `FORCE_HTTPS=true`, your HTTPS `APP_ORIGIN`, and `TRUST_PROXY=1` behind the same-host proxy. Keep `HOST=127.0.0.1`. Production startup rejects missing HTTPS configuration.

These examples assume exactly one trusted proxy and a backend that cannot be reached directly from the internet. Re-evaluate proxy trust for a CDN, another proxy hop, or a containerized proxy. Inside another container, `127.0.0.1` refers to that container; the supplied host-proxy example cannot be copied unchanged.

## Keep Node running

Use your operating system's service manager with a dedicated account, a fixed working directory, environment loading, restart-on-failure, and access restricted to required directories. Do not depend on an open terminal for production.

Example Linux systemd unit, assuming the dedicated `zaddesh` account and `/opt/zaddesh` installation already exist:

```ini
[Unit]
Description=ZadDesh infrastructure dashboard
After=network.target

[Service]
Type=simple
User=zaddesh
Group=zaddesh
WorkingDirectory=/opt/zaddesh
EnvironmentFile=/opt/zaddesh/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/zaddesh/server/index.js
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Verify the Node binary path, build the frontend first, and grant the service account access to `.env`, the data directory, and backups. Save the unit as `/etc/systemd/system/zaddesh.service`, then run `sudo systemctl daemon-reload` and `sudo systemctl enable --now zaddesh`. Inspect `sudo systemctl status zaddesh`. Windows/macOS service managers need the same working directory and environment guarantees.

## Configuration reference

| Variable | Purpose / default |
| --- | --- |
| `VAULT_SECRET` | Required persistent random secret, at least 32 characters. Preserve with backups. |
| `HOST` | Bind address; default `127.0.0.1`, container `0.0.0.0`. |
| `PORT` | HTTP port, default `8443`; Compose uses it as the host port. |
| `APP_ORIGIN` | Exact external scheme, hostname, and port. Used for origin checks and passkeys. |
| `NODE_ENV` | Set `production` for a production service; Compose does this. |
| `DATA_DIR` | SQLite directory, default `./data`; Compose `/app/data`. |
| `FORCE_HTTPS` | Require HTTPS requests; production must use `true`. |
| `TRUST_PROXY` | Trusted proxy hop count; direct local preview `0`, supplied proxy arrangement `1`. |
| `SESSION_IDLE_MINUTES` | Idle timeout; default `20`. |
| `SESSION_MAX_HOURS` | Absolute session lifetime; default `12`. |
| `INITIAL_ADMIN_PASSWORD` | Optional initial temporary password; blank generates one. Not a reset mechanism. |
| `BACKUP_PASSWORD` | Separate full-backup encryption passphrase, at least 16 characters. |
| `SSH_TARGETS_JSON` | Approved browser-SSH `host:port` to `SHA256:...` host fingerprint map; default `{}`. |
| `PING_ALLOWED_CIDRS` | Allowed private networks for TCP probes. Defaults to RFC1918 IPv4 and `fc00::/7`; empty blocks private ranges. |

Restrict probe ranges to networks you intend users to reach. Loopback, link-local, and metadata destinations remain blocked. A TCP success only confirms a listening port, not application health.

For browser SSH, obtain host fingerprints through a separately trusted channel and configure the exact host/port mapping shown in `.env.example`. Do not blindly trust a key obtained over the same unverified connection. Restart after configuration changes. Saved credentials and server-side connectivity are required.

## Backups and recovery

| Format | Contents | Recovery requirements |
| --- | --- | --- |
| Entry JSON | Resource definitions without saved credentials | Import into your account; entries are appended. |
| Personal `.zdvault` | Current user's entries and saved credentials | Archive passphrase and destination account password; imported credentials are re-encrypted. |
| Full `.zdb` | Entire database, including accounts and encrypted vaults | Backup passphrase, original `VAULT_SECRET`, and users' passwords from the snapshot. |

Protect all exports: even plain JSON may expose private hostnames. Full backup/restore is a host-operator operation, not an admin dashboard capability.

Set `BACKUP_PASSWORD` in the protected environment, then:

```sh
npm run backup
```

Or for Docker:

```sh
docker compose exec zaddesh npm run backup
```

The command reports a timestamped file in `backups/` or `/app/backups/`. It uses a consistent SQLite snapshot, encrypts it, and removes the temporary plaintext snapshot. Deletion is not secure erasure; protect the disk and filesystem. Schedule backups with your host scheduler and copy them off-host. Store recovery secrets separately from backup archives. Record the application revision and proxy configuration.

To copy a container backup out, substitute the actual filename reported by the command:

```sh
docker compose cp zaddesh:/app/backups/zaddesh-1234567890000.zdb ./zaddesh-1234567890000.zdb
```

### Restore a Node installation

Stop the application. Retain the original `VAULT_SECRET` and correct `BACKUP_PASSWORD` in the environment. Restore into a new empty directory; the tool refuses to overwrite an existing database or WAL/SHM files.

PowerShell:

```powershell
$env:DATA_DIR='./restored-data'
npm run restore -- backups/zaddesh-1234567890000.zdb
```

Linux/macOS:

```sh
DATA_DIR=./restored-data npm run restore -- backups/zaddesh-1234567890000.zdb
```

Replace the example filename. After successful restoration, update the persistent service configuration to the restored directory and restart. The tool checks SQLite integrity and foreign keys and removes sessions and challenges. Sign in again using snapshot-era account credentials.

### Restore a Docker installation

Ensure the archive is in the backup volume before stopping the service. If necessary, use `docker compose cp` to copy it into `/app/backups/` while the container is running. Preserve the existing database and restore into a new subdirectory of the data volume:

```sh
docker compose stop zaddesh
docker compose run --rm --no-deps -e DATA_DIR=/app/data/restored zaddesh npm run restore -- /app/backups/zaddesh-1234567890000.zdb
```

Create a local `compose.restore.yml`:

```yaml
services:
  zaddesh:
    environment:
      DATA_DIR: /app/data/restored
```

Start using both configurations:

```sh
docker compose -f docker-compose.yml -f compose.restore.yml up -d
```

Keep using that override for subsequent operations; otherwise you will return to the original data directory. Use the original secret and the correct backup passphrase. Test restoration before relying on backups for disaster recovery.

## Updates and rollback

1. Back up and record the current revision with `git rev-parse HEAD`.
2. Read [migration notes](../MIGRATION.md) and release changes. Preserve local deployment configuration.
3. Pull the reviewed version with `git pull --ff-only`.
4. For Node, run `npm ci`, `npm test`, and `npm run build`, then restart the service. For Docker, run `docker compose up -d --build` using any deployment overrides.
5. Check sign-in, your resources, vault access, and representative connections. Reload the unpacked extension or reinstall the desktop launcher when those components change.

A rollback may need both the old application version and its compatible pre-upgrade database snapshot. Restore into a new directory instead of overwriting the current database. Do not assume database migrations are reversible.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Startup fails | Node 24, persistent secret, valid port, permissions, and production HTTPS settings. |
| Browser cannot reach app | Process/container status, occupied port, host binding, DNS, firewall, and proxy upstream. |
| HTTPS-required or CSRF errors | Exact `APP_ORIGIN`, browser URL, forwarded scheme, and trusted proxy configuration. |
| Proxy returns 502 | Backend is running at the configured address; a container's loopback is not the host. |
| Empty workspace after restart | Correct account, `DATA_DIR`, Compose project name, and persistent volume. |
| Vault unavailable after passkey login | Confirm the account password to unlock password-derived credentials. |
| Lost account password | Admin reset is deliberately unavailable. A passkey does not recover the vault encryption password. Keep tested personal exports and recovery records. |
| Connect does nothing | Install the launcher/vendor client on the browsing computer and approve the browser's external-app prompt. |
| Direct login fails | Use supported Chrome/Edge extension setup and a permitted HTTPS form; handle MFA/SSO/custom forms manually. |
| TCP check blocked/offline | Probe policy, DNS, server-side routing/firewall, and actual service port. |
| Browser SSH fails | Host fingerprint map, server-side reachability, saved login, and proxy WebSocket forwarding. |
| Restore refused | New empty destination and correct backup password; retain original secret. |

`/healthz` confirms process availability, not every downstream service or a complete disaster-recovery test.

## Production security practices

- Use trusted HTTPS and keep the backend private; restrict dashboard exposure to a VPN or trusted network where appropriate.
- Enable MFA, use unique account passwords, and assign the minimum required role.
- Protect `.env`, data, backups, and startup logs with filesystem permissions and disk encryption.
- Keep the OS, Node/container base, dependencies, browser extension, and native clients updated.
- Back up off-host and test restoration. Retain secrets independently; avoid passwords in shell history.
- Treat host administrators as trusted operators. Application-level owner isolation cannot prevent an operator from modifying the server software.

Review [AUDIT.md](../AUDIT.md) for tested protections and limitations. No claim of complete security or independent certification is made.
