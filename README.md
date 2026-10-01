# ZadDesh

**Mahzaidex Tech · Developed by Hasnain Zaidi**

A self-hosted infrastructure dashboard with private user workspaces, an encrypted credential vault, offline icons, and desktop remote-tool launchers. React 19, Express 5, Node.js 24, and SQLite. No CDN or external font dependency.

## Run locally

Install Node.js 24 or newer. From this folder:

```sh
npm ci
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell; `cp .env.example .env` on Linux/macOS). Generate a unique secret and put it in `VAULT_SECRET`:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then:

```sh
npm run build
npm start
```

Open **http://localhost:8443**. Local HTTP is for loopback development only. The default host is `127.0.0.1`; `PORT`, `HOST`, and `APP_ORIGIN` are configurable. The browser origin must match `APP_ORIGIN` exactly, including port. `npm run dev` also serves the built frontend; rebuild after source changes. `npm run icons` and `npm run brand` regenerate checked-in icon assets.

### First login

A new database creates `admin` with a cryptographically random temporary password printed once in the server console. Alternatively supply your own `INITIAL_ADMIN_PASSWORD` environment variable before initial startup. It does not reset an existing account. Every new account must change its temporary password before using any dashboard API. Passwords require 14 characters, uppercase, lowercase, and a number. Use a long, unique passphrase.

Existing accounts keep their passwords. The migration in this workspace assigned all 12 legacy entries to `admin`, as explicitly requested. Other accounts start empty. See [MIGRATION.md](MIGRATION.md).

## Dashboard controls

- Add/edit resources through the drawer: name, HTTP URL or remote address, category, description, icon, open method, optional username/password.
- Search names, addresses, descriptions, and categories; **Ctrl+K / Cmd+K** focuses search.
- Pin favorites and filter collections from the sidebar. The dashboard uses one continuous grid.
- **Expand all cards / Collapse all cards**, plus a chevron on each card. Compact cards retain their launch title, favorite, and Ping controls.
- Collapse the desktop sidebar to an icon rail using the top-left menu button. Mobile has an opening/closing navigation drawer.
- Dark/light themes, five accents, card mode, and desktop sidebar state are stored on the server per user.
- Move resources earlier/later using the arrow buttons in expanded cards. Search/filtering does not change saved order.
- **Ping** per resource and **Ping visible resources** report TCP port reachability and latency from the ZadDesh host. This is not ICMP or proof of application health. HTTP(S), RDP, and SSH are supported; AnyDesk/RustDesk IDs cannot be directly probed.
- Public unicast destinations and configured `PING_ALLOWED_CIDRS` are probeable. Defaults include RFC1918 LANs and IPv6 ULA. Loopback, link-local, multicast, reserved addresses, and metadata endpoints are denied. DNS results are validated and the connection is pinned to the resolved IP. Set `PING_ALLOWED_CIDRS=` to deny private-network probes. Apply outbound firewall rules in sensitive environments.
- JSON import/export includes only the current user's shortcut definitions and custom icons. Export excludes credentials. Imports append validated records as the importing user; ownership and vault ciphertext in an input file cannot grant access to another user's data.

## Roles and isolation

Admin manages accounts and sees only their own activity events, but dashboard routes always require the current user's ownership, including admins. Editor manages their own resources. Viewer can read and launch their existing resources but cannot create/edit/delete/import/reorder. An Editor can be downgraded to Viewer after configuring their dashboard.

New accounts are empty; there is no automatic sharing or seed data. Categories and custom icons are embedded in owner-scoped entry records rather than global mutable tables. Settings have `owner_id`. Optional sharing is intentionally absent from this private-workspace version.

Audit logs expose only the current user’s events, including for admins; they contain actor/action/opaque resource IDs, never target credentials. The log is append-only through the application API, **not immutable against the server/database operator**.

## Vault and account recovery

Login hashes use Argon2id (64 MiB, 3 iterations, 1 lane). Credentials use AES-256-GCM with a fresh random 96-bit nonce and authenticated user/entry context. Each user's encryption key is derived from their password using scrypt (N=32768, r=8, p=1) and a unique random salt. Password-derived vault objects exist only in server memory for an unlocked session; they are not serialized into the database.

The server's `VAULT_SECRET` protects TOTP secrets and validates/migrates legacy vaults. It does **not** derive new users' credential keys. After a server restart or passkey login, confirm the account password under Security & account before saving credentials. Every reveal requires the password again; returned credentials hide after 30 seconds or when the page is hidden.

**Password change:** verify the current password, decrypt only that user's records, atomically re-encrypt with a new salt/key, update the Argon2 hash, revoke other sessions, and rotate the active session.

**Forgotten password:** account administrators cannot reset passwords. This prevents impersonation and disclosure of private shortcut metadata. An enrolled passkey can restore dashboard access, but the original password is still required to unlock the vault. Keep an independent recovery copy in a trusted password manager.

Admins cannot retrieve another user's vault through application APIs. A malicious host operator can change the software or capture future passwords; this is not a client-side zero-knowledge vault. Account administrators manage account status and roles only; user changes require fresh password confirmation. Activity logs are filtered by immutable account ID, including for Admin accounts. Legacy events without a trustworthy owner remain in the database for host-level review and are excluded from the app.

Clipboard clearing is **best effort**: browsers may deny clipboard reads/writes in the background, and operating-system history or sync can retain copied secrets. ZadDesh never claims to wipe clipboard history.

Direct login is provided by the optional Chrome/Edge extension for approved HTTPS websites with standard same-origin POST login forms. It uses the existing form, never guessed login endpoints. Install and configure the extension using [extension/README.md](extension/README.md). MFA, CAPTCHA, SSO and custom/multi-step forms may need manual interaction.

## RDP and terminal launch

**RDP:** clicking the card or Connect requests the installed Windows ZadDesh launcher, which starts Remote Desktop with the target host and port. No file downloads automatically. The explicit Download button exports a UTF-16LE/BOM profile without a password. Other platforms can import that profile into their native RDP client. See [desktop setup](desktop/README.md).

**SSH:** clicking the card requests the Windows launcher to open OpenSSH in a terminal. The dialog also offers optional browser SSH, a copyable command, native protocol fallback, and explicit script downloads for Windows/macOS/Linux. The bridge is Windows-only and must be installed on the client computer, not merely on the hosting server. No passwords appear in launch URLs or commands.

**AnyDesk / RustDesk:** `anydesk:ID` and `rustdesk://ID`, with spaces removed from numeric IDs. Install the official client and permit its handler. See the in-app setup links.

The original RDP action tried two competing URI schemes 300 ms apart. The original SSH command-palette route could treat a remote address as a web URL. The replacement has distinct Connect, Download, command, and optional browser-terminal actions. See [AUDIT.md](AUDIT.md) for findings and verification limits.

### Optional in-browser SSH

Disabled unless `SSH_TARGETS_JSON` maps an explicit `host:port` to its verified OpenSSH `SHA256:` fingerprint. Obtain fingerprints from a separately trusted administrator or local server console, not unauthenticated first contact. Set the JSON in `.env` and restart. Example syntax is in `.env.example`; do not use an example fingerprint as a real key.

The xterm.js terminal requires account-password confirmation and saved target credentials. Tickets expire after 30 seconds, are single-use, and are bound to the authenticated session. WebSocket Origin and session are validated; logout/expiry closes the terminal. Target IPs are resolved once and host keys are verified before authentication. No arbitrary destination outside the configured map can be connected. Use network ACLs and least-privilege SSH accounts. Password authentication is supported; SSH agent forwarding and private-key uploads are not.

## MFA and passkeys

Security & account requires password confirmation before authenticator enrollment or passkey registration/removal. TOTP prevents reuse of an accepted time step. Disabling TOTP requires both password and current authenticator code. Passkeys require user verification, origin/RP validation, a browser-bound one-time challenge, and counter checks. Passkey sign-in is an alternative strong authentication method; it does not require an additional TOTP code. It still cannot unlock a password-derived vault without the password.

Passkeys need HTTPS, except trusted localhost development. Configure `APP_ORIGIN` before enrolling; moving to a different hostname requires re-enrollment. Multiple passkeys can be registered and individually removed.

## Encrypted backup and restore

Set a separate `BACKUP_PASSWORD` (16+ characters) in the environment, then:

```sh
npm run backup
```

This uses SQLite `VACUUM INTO` to capture a consistent snapshot including committed WAL changes, then encrypts the whole database with AES-256-GCM and a scrypt-derived backup key. Files are written as `backups/zaddesh-<timestamp>.zdb`. The temporary plaintext snapshot is removed in a `finally` block; disk encryption remains recommended because file deletion is not secure erasure.

Restore into a **new, empty** `DATA_DIR`, never over a running/existing database:

```powershell
$env:DATA_DIR = './restored-data'
$env:BACKUP_PASSWORD = 'your separately stored backup passphrase'
npm run restore -- backups/zaddesh-<timestamp>.zdb
```

On POSIX shells use `DATA_DIR=./restored-data BACKUP_PASSWORD='...' npm run restore -- backups/file.zdb`. Avoid literal secrets in shell history in production; inject them with your secret manager. Restore authenticates the backup, checks SQLite and foreign-key integrity, removes sessions/challenges, and refuses to overwrite an existing database. Start with the **original** `VAULT_SECRET`; users need the passwords they had when the snapshot was taken. Do a recovery drill before relying on backups.

Migration `.zdb` snapshots in `data/` use the existing `VAULT_SECRET` as their backup password. Retain these securely until migration is verified, then apply your retention policy.

## Docker and HTTPS

Set `APP_ORIGIN=https://zaddesh.your-real-domain` and a unique `VAULT_SECRET` in `.env`. Configure the Nginx or Caddy example in `deploy/` on the same host, with your domain/certificates, then:

```sh
docker compose up -d --build
docker compose logs zaddesh
```

Compose binds the backend only to loopback, runs the container as non-root with a read-only root filesystem, drops capabilities, and uses persistent data/backup volumes. The reverse proxy provides TLS. Production requires `FORCE_HTTPS=true`, an HTTPS origin, and trusted proxy configuration. Never expose port 8443 directly with `TRUST_PROXY=1`; clients could forge forwarded headers. `TRUST_PROXY=0` is the default for local direct access.

Docker backup: `docker compose exec zaddesh npm run backup`. Copy encrypted files out of the backup volume and store them off-host. Docker Engine was unavailable during development here, so the container configuration is supplied but a container build/run is not claimed as tested.

## Production security practices

1. Keep the dashboard behind a VPN or access gateway; use trusted HTTPS and correctly scoped reverse-proxy trust.
2. Use unique long passwords and enroll TOTP/passkeys. Minimize Admin/Editor accounts and use least-privilege target credentials.
3. Protect `.env`, SQLite, and backups with OS permissions and disk encryption; keep keys and backup passwords separately.
4. Restrict outbound network access for probes, favicon fetching, and SSH; allow only required infrastructure.
5. Apply dependency/security updates, review audit events, and test encrypted restores. Do not log request bodies, cookies, or WebSocket query strings at the proxy.
6. Run one application instance with local SQLite storage. Rate limits and unlocked keys are process-local; multi-replica deployment needs shared rate limiting/session design. SQLite on network filesystems is unsupported.
7. Obtain independent security review before storing production secrets. Automated tests do not establish that an application is vulnerability-free or future-proof.

## Verification

```sh
npm test
npm run build
```

Tests cover ownership/IDOR (including Admin), required first password change, CSRF/origin, encrypted credentials and tampering, password re-keying, session revocation/logout, TOTP replay rejection, blocked admin password resets and private activity logs, settings isolation, RDP file encoding, native SSH file generation/injection, and encrypted backup/restore. Browser checks use a separate disposable fixture, never production entries: `node test/preview.js` serves only loopback port 8444. Stop it when finished.

## Source structure

```text
ZadDesh/
  server/
    index.js            startup and WebSocket attachment
    app.js              validated API, sessions, roles, ownership, MFA
    db.js               schema, safe migration, user vault unlock
    config.js           environment validation
    security.js         Argon2id, scrypt, AES-GCM, input validation
    backup.js           encrypted SQLite snapshot and restore
    network.js          DNS/IP network policies
    ping.js              TCP reachability probes
    favicon.js          bounded public-site icon fetch
    rdp.js              RDP profile serialization
    ssh-proxy.js        allowlisted, host-key-verified SSH proxy
    icons.json          local icon metadata
  shared/launch.js      remote address validation, SSH scripts, protocols
  src/
    main.jsx            React entry
    Dashboard.jsx       authentication, workspace, vault/security dialogs
    index.css           base controls
    dashboard.css       themes, responsive layout, compact controls
    components/
      ResourceCard.jsx  compact/expanded card, ping, pin, actions
      EntryModal.jsx    add/edit drawer
      IconPicker.jsx    searchable offline library and custom icons
      UserManagementModal.jsx
      AuditLogModal.jsx
      SshTerminalModal.jsx
    data/icons.json     frontend icon metadata
  public/
    icons/              216 bundled SVG icons
    brand/              logo.svg, mark.svg, 16/32/180/192/512 PNGs
    favicon.svg, favicon.ico, apple-touch-icon.png, site.webmanifest
  scripts/
    icons.js, brand.js, backup.js, restore.js, migrate-owners.js
  test/security.test.js  ownership, vault, recovery and launch tests
  test/auth.test.js      lockout, session expiry, roles and probe policies
  test/ssh.test.js       local SSH transport, origin and ticket replay tests
  test/preview.js        disposable local UI fixture
  deploy/nginx.conf, deploy/Caddyfile
  Dockerfile, docker-compose.yml, .dockerignore, .env.example
  README.md, AUDIT.md, MIGRATION.md, CHANGES.md, THIRD_PARTY_NOTICES.md
```

SVG brand assets and favicon PNG/ICO variants are generated by `npm run brand` using Sharp. The on-screen `Zad__` text uses a blinking final underscore and respects reduced-motion preferences. The manifest supplies installation icons; authenticated resources are not cached by a service worker.

SQLite is the supported database. PostgreSQL/MySQL adapters, generic auto-login, shared dashboards, and browser SSH private-key upload are not included.

## Native launch, layout, and personal-vault update

- **Connect** requests an external client without downloading anything. **Download Remote Desktop profile** is the only RDP download action. The Windows launcher is installed on this development computer; setup for other computers is in [desktop/README.md](desktop/README.md).
- Card layout choices are Compact grid, Comfortable grid, and List. Layout and detail-expansion preferences are independent and saved per user.
- Users can reveal/copy their own credentials after password confirmation and use **Edit saved credentials** to replace them. **Import & export → Encrypted personal vault** exports only the current user's entries and credentials under a separate archive password. Imports append new entries encrypted with the importing user's key. JSON shortcut export still excludes secrets.
- Web cards with saved credentials offer direct login through the optional [Chrome/Edge extension](extension/README.md). It supports recognizable same-origin HTTPS POST login forms. Arbitrary web pages, MFA/CAPTCHA, SSO, and custom multi-step forms cannot be guaranteed. Manual extension installation is required; it is unavailable in the in-app browser.
