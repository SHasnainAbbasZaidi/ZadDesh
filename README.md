# ZadDesh

<p align="center"><img src="public/brand/logo.svg" alt="ZadDesh — Zad__" width="320"></p>

**Your infrastructure. One private workspace.**

ZadDesh is a self-hosted dashboard for the tools you use to run an IT environment. Bring hosting panels, firewalls, monitoring services, inventory systems, cloud consoles, and remote machines into one searchable workspace. Open a service, launch a remote client, check a port, or access your encrypted credentials from its card.

**Mahzaidex Tech · Developed by Hasnain Zaidi**

[Self-hosting guide](docs/SELF_HOSTING.md) · [User guide](docs/USER_GUIDE.md) · [Security review](AUDIT.md) · [Publication notes](docs/PUBLISHING.md)

![ZadDesh dashboard showing a comfortable card grid, sidebar collections, and display controls](docs/images/dashboard.png)

*Demo workspace with sample resources. Fresh installations start empty; screenshots contain no production credentials or private infrastructure.*

## What you can do

| Feature | How it helps |
| --- | --- |
| Resource cards | Add a name, URL or remote address, category, icon, notes, launch method, and optional credentials. Edit, delete, pin, and reorder your own entries. |
| Search and collections | Find a service with Ctrl+K / Cmd+K, search names and addresses, or filter from the sidebar. |
| Personal layouts | Choose compact grid, comfortable grid, or list. Expand details per card or all at once; collapse the sidebar to an icon rail. |
| Themes | Dark and light modes with five accent choices; display preferences are saved per account. |
| Offline icons | 216 bundled icons, searchable picker, custom PNG/SVG uploads, and constrained PNG favicon fetching. No runtime icon/font CDN. |
| Remote access | Windows RDP/SSH/Telnet desktop launcher, AnyDesk/RustDesk protocol links, explicit connection-file downloads, and optional browser SSH. |
| Encrypted vault | Password-confirmed viewing/copying and editing of your own credentials; encrypted personal import/export. |
| Private accounts | Admin, Editor, and Viewer roles. Entries, credentials, layouts, exports, and activity remain owner-scoped, including for admins. |
| Authentication | Mandatory first password change, optional TOTP and passkeys, session expiry, CSRF protection, login throttling, and account lockout. |
| Reachability | Individual or batch TCP port checks with latency and blocked/unresolved feedback. This is not ICMP or full application monitoring. |
| Direct web login | Optional Chrome/Edge extension for approved HTTPS sites with recognizable, same-origin POST login forms. |
| Self-hosted storage | SQLite, local assets, encrypted database backups, Docker configuration, and Caddy/Nginx examples. |

## Use cases

- **Homelabs:** organize Proxmox, Portainer, Grafana, Uptime Kuma, NAS panels, and remote machines without searching through bookmarks.
- **System administration:** keep firewall consoles, management interfaces, jump hosts, and server connections in one personal operational workspace.
- **Hosting operations:** group cPanel, WHM, DNS providers, hosting portals, and support tools with searchable notes and saved credentials.
- **Small IT teams:** provide individual accounts on a single self-hosted instance while keeping each person's resources and credentials private.
- **Support work:** keep frequently used RDP, SSH, AnyDesk, and RustDesk destinations close at hand, with explicit client-launch controls.

ZadDesh is a shortcut and credential dashboard. It does not replace a monitoring platform, inventory database, enterprise secrets manager, or remote-access server. Shared team vaults and shared dashboards are not implemented.

## Quick start: local preview

Install Git and **Node.js 24** with npm. Clone the repository and install its locked dependencies:

```sh
git clone https://github.com/SHasnainAbbasZaidi/ZadDesh.git
cd ZadDesh
npm ci
```

Copy the configuration template:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```sh
# Linux / macOS
cp .env.example .env
```

Generate a secret, then paste the output into `VAULT_SECRET` in `.env`:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Keep `APP_ORIGIN=http://localhost:8443`, `HOST=127.0.0.1`, and `FORCE_HTTPS=false` for this loopback preview. Start the application:

```sh
npm run build
npm start
```

Open **http://localhost:8443**. On a fresh database, the server prints a random temporary password for `admin` once. Change it on first login before using the dashboard. Add your first resource with **Add resource**.

The application serves HTTP internally even though its default port is 8443. For remote access or production, follow the [self-hosting guide](docs/SELF_HOSTING.md) to configure a trusted HTTPS reverse proxy. GitHub Pages cannot run this backend.

## Screenshots

The dashboard above shows the continuous card grid, saved layouts, favorites, search, and sidebar collections. It uses a disposable demo workspace.



## Important behavior

- **Connect is not Download.** RDP/SSH Connect invokes the installed Windows bridge. An RDP profile downloads only when you choose its Download link. Native clients and browser permission to open them are still required.
- **Client setup belongs on the client.** Install the [desktop launcher](desktop/README.md) on each Windows computer used to open cards. Installing it on the hosting server alone does not configure remote users' browsers.
- **Automatic login is conditional.** Install the [direct-login extension](extension/README.md) manually in Chrome/Edge and approve each destination. MFA, CAPTCHA, SSO, redirects to another origin, and custom/multi-step forms can require manual login. The in-app browser does not support this extension.
- **Credentials remain encrypted in storage.** Viewing, copying, or transferring a personal vault requires the user's account password. Clipboard clearing is best effort; OS clipboard history may retain a copy.
- **Admin is not a vault owner.** Admins manage account status and roles, but cannot use application APIs to read other users' entries, credentials, layouts, or activity. Admin password resets are deliberately disabled to prevent impersonation.
- **The host remains trusted.** Someone with direct OS/database access can read unencrypted resource metadata or alter the running program. This is not a client-side zero-knowledge vault.

## Technology and deployment

React 19 · Express 5 · Node.js 24 · SQLite · xterm.js · WebAuthn

Run the server directly on Windows, Linux, or macOS, or use the included Dockerfile and Compose configuration on a compatible Docker host. A persistent Node process, writable local storage, and outbound access to the intended targets are required. Static hosting, ephemeral serverless deployments, and ordinary PHP-only shared hosting are unsuitable. SQLite is the supported database; PostgreSQL/MySQL adapters are not included.

See [installation, HTTPS, configuration, backups, updates, and troubleshooting](docs/SELF_HOSTING.md), and [daily use and account recovery](docs/USER_GUIDE.md).

## Verification and limitations

The latest local verification passed **12 automated tests** and the production frontend build. Tests cover owner isolation, authentication, encryption, vault archive roundtrips, remote launch validation, browser SSH transport, and extension origin/form checks.

```sh
npm test
npm run build
```

Docker container execution, hardware-specific passkey ceremonies, and live third-party/native-client authentication have not been fully verified across supported platforms. This project has undergone development-time security review, not an independent certification. See [AUDIT.md](AUDIT.md) for evidence and remaining risks.

## Repository map

```text
src/          React dashboard and UI components
server/       API, authentication, vault, SQLite, probes, SSH, backups
shared/       Remote-address and launch helpers
public/       Local icons, logo, favicon, manifest
extension/    Optional Chrome/Edge direct-login extension
desktop/     Windows launcher source and setup scripts
deploy/      Caddy and Nginx examples
scripts/     Asset generation, backup, restore, migration commands
test/        Automated tests and disposable UI preview
docs/        User guide, self-hosting guide, screenshots, publication notes
```

See [CHANGES.md](CHANGES.md) for changes and [MIGRATION.md](MIGRATION.md) before upgrading an older database.

## Project status and attribution

Created by **Hasnain Zaidi** for **Mahzaidex Tech**. Vendor names and icons belong to their respective owners and do not imply endorsement. See [third-party notices](THIRD_PARTY_NOTICES.md).

No project license has been selected yet. Public visibility alone does not grant an open-source license; review the [publication checklist](docs/PUBLISHING.md) before announcing licensing or publishing a release. Never include real passwords, private hostnames, personal vault files, or database backups in a public issue or screenshot.
