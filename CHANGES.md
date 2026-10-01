# File-by-file change inventory

All executable source is present in this workspace. There are no deferred implementation stubs.

## New files

- `server/app.js`: validated owner-scoped API, session security, MFA/passkeys, role enforcement, import/export.
- `server/backup.js`: encrypted, WAL-consistent snapshots and guarded restore.
- `server/network.js`: DNS/IP validation and pinned network destinations.
- `server/ssh-proxy.js`: opt-in, session-bound, host-key-verified terminal proxy.
- `shared/launch.js`: common remote address validation, protocol URLs, and native SSH launch files.
- `src/Dashboard.jsx`: updated private workspace, login, vault, security, transfer and launch dialogs.
- `src/dashboard.css`: responsive design, themes, sidebar rail, compact/expanded cards.
- `src/components/ResourceCard.jsx`: ping, pin, launch, expand, reorder, edit and delete controls.
- `scripts/brand.js`: local SVG/PNG/ICO asset generation.
- `scripts/migrate-owners.js`: explicit transactional ownership migration.
- `test/security.test.js`: security, isolation, encryption, recovery and launch regression tests.
- `test/auth.test.js`, `test/ssh.test.js`: account/session defenses, network policy, and local SSH WebSocket integration tests.
- `test/preview.js`: disposable, loopback-only UI fixture.
- `public/brand/*`, `public/icons/*`, `public/favicon.ico`, `public/apple-touch-icon.png`, `public/site.webmanifest`: generated local assets.
- `.dockerignore`, `AUDIT.md`, `MIGRATION.md`, `CHANGES.md`, `THIRD_PARTY_NOTICES.md`: deployment exclusions, review and handoff documentation.

## Updated files

- `server/index.js`: application startup, shutdown and WebSocket attachment.
- `server/config.js`: fail-closed secrets, HTTPS and session configuration.
- `server/db.js`: owner enforcement, snapshots, password-derived vault migration.
- `server/security.js`: password policy, encryption and URL/remote/icon validation.
- `server/rdp.js`: safe username handling, explicit credential prompt, CRLF profile fields.
- `server/ping.js`: bounded TCP reachability for owned web/RDP/SSH resources.
- `server/favicon.js`: bounded public-site favicon retrieval with certificate checks.
- `server/icons.json`, `src/data/icons.json`, `scripts/icons.js`: offline metadata and SVG file generation, including required vendor/generic icons.
- `src/main.jsx`, `src/index.css`: new application entry, local styling, no external fonts.
- `src/components/EntryModal.jsx`: add/edit drawer, credential replacement semantics, custom category preservation, accessible labels.
- `src/components/IconPicker.jsx`: local image files, searchable catalog, constrained favicon API.
- `src/components/UserManagementModal.jsx`: fresh password confirmation for account changes; password-reset controls removed.
- `src/components/AuditLogModal.jsx`: accurate audit trust description.
- `src/components/SshTerminalModal.jsx`: password confirmation, safe terminal transport, cleanup.
- `scripts/backup.js`, `scripts/restore.js`: encrypted snapshot CLI and non-overwriting restore.
- `Dockerfile`, `docker-compose.yml`, `deploy/nginx.conf`, `deploy/Caddyfile`: non-root deployment, working health check, trusted HTTPS proxy examples.
- `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `index.html`, `public/favicon.svg`, `README.md`: configuration, dependencies, branding and setup.

## Removed superseded source

`src/App.jsx`, `EntryCard.jsx`, `LoginView.jsx`, `Navbar.jsx`, `Sidebar.jsx`, `PasswordChangeModal.jsx`, `TwoFactorModal.jsx`, `BackupModal.jsx`, `AutoLoginModal.jsx`, `CommandPalette.jsx`, and `server/ssh.js` were replaced by the files above. Their supported user-facing functions are integrated into the new workspace. The old unverified SSH transport and competing RDP auto-redirects are not retained.

Original user-provided `logo.png`, `public/logo.png`, and `Demo UI.jpeg` are preserved as references and are not required at runtime. Existing `.env` secrets and account passwords were not replaced; local `HOST` was limited to loopback.

## October 1 privacy and branding update
- Admin password resets removed; sensitive account changes require recent password confirmation.
- Private activity logs use immutable account IDs. Legacy unowned events remain in storage only.
- Authentication completion rechecks revocation and current account state.
- New vector mark and matching PNG/ICO favicons used in login, sidebar, and browser tab.
- Seven automated tests and production build pass; full npm audit reports zero known vulnerabilities.

## Native launch and personal vault update
- Added desktop/Launcher.cs with current-user install/uninstall scripts. Validated destination-only RDP/SSH protocol launch; no credentials in command lines or files.
- Removed automatic RDP download and added per-user grid/comfortable/list layouts.
- Added encrypted owner-only vault archive import/export with password reauthentication, random salt, authenticated encryption, validation before atomic import, and per-entry re-encryption.
- Added extension/ and DirectLogin UI for explicitly permitted same-origin HTTPS POST login forms. Extension installation is manual; browser automation blocks internal extension-management pages.
- Added vault roundtrip, tamper, owner isolation, native URL and extension security/form tests. Actual target client connection and third-party login remain dependent on client permissions and target authentication.
