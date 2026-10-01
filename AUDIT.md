# Security and logic audit

Audit baseline: the existing source and SQLite database that appeared during this session, before the v2 fixes. Other editing was paused by the user. This is a source review and targeted test report, not an independent penetration test or a guarantee of production security.

## Findings and fixes

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | Admin bypasses could read, edit, delete, reveal, reorder, and launch another user's resources. JSON export selected every entry. | Entry lookups and mutations always require current `owner_id`, including Admin. Favorites/probes/launchers enforce the same boundary. Exports are per-user; unauthorized IDs return 404. |
| Critical | All saved credentials used a server-wide key; Admin could decrypt other users' vaults. | Password-derived per-user scrypt keys, random per-user salts, AES-256-GCM with random nonce and user/entry authenticated context. Keys stay in memory. No admin vault-reveal bypass. |
| High | The live database lacked `owner_id`, producing `no such column: e.owner_id`. The old migration caught every error and silently proceeded. | Explicit owner mapping, encrypted pre-migration snapshot, transaction, and required-owner triggers. All 12 existing entries assigned to Admin account ID 1 with user authorization. No silent fallback assignment. |
| High | Reveals had a login-time grace period; re-authentication could be bypassed immediately after login. | Every reveal verifies the account password. Frontend clears revealed state after 30 seconds and when hidden. Rate limits protect verification. |
| High | Password changes did not re-key records or revoke other sessions. Reset left old credentials readable under the server key. | Atomic per-user re-keying and session revocation. Reset requires explicit vault-loss confirmation, erases credentials/MFA, and forces password change. |
| High | Logout omitted CSRF, so the UI appeared signed out while the server session remained live. | CSRF-authenticated logout deletes the session; expired sessions return 401 and clear the UI. |
| High | Passkey login used the latest global challenge and preferred rather than required user verification. | Browser-bound challenge cookie, single-use expiry, required UV, RP/origin/counter checks; password confirmation for enrollment/removal. |
| High | TOTP secrets were plaintext and accepted codes could be reused. Enrollment trusted a client-supplied secret. | Server-held encrypted enrollment challenge, encrypted stored secret, atomic time-step replay prevention, password confirmation; password plus TOTP required to disable. Legacy secrets encrypt on successful password login. |
| High | Favicon fetch had an unused private-IP checker and disabled TLS verification. Ping accepted arbitrary submitted targets. | Favicon fetch validates/pins public DNS, verifies TLS, refuses redirects, limits time and bytes, and only returns checked image data. Ping accepts an owned entry ID and uses constrained TCP probes instead of arbitrary HTTP requests. |
| High | Browser SSH lacked host-key verification, session-bound WebSocket upgrades, destination controls, and bounded messages. | Proxy is opt-in with exact destination/fingerprint map; strict Origin/session/ticket checks, one-time expiry, host-key verification before authentication, message/output bounds, and session-expiry termination. |
| High | Backup copied the SQLite main file without WAL consistency; restore overwrote a live database. JSON ciphertext imports broke authenticated entry-ID context. | Consistent SQLite snapshots encrypted as a whole; integrity-checked restore into an empty directory only. JSON exchange excludes credentials and inserts validated owner-scoped definitions. |
| High | Docker included a known key, ran as root, and its health check always succeeded. HTTPS configuration was not actually enforced. | Environment-only secret, non-root read-only container, dropped capabilities, real health check, HTTPS-required production startup and requests, loopback published backend port. |
| Medium | RDP attempted `ms-rdp:` then `rdp://` after 300 ms; unsupported handlers and competing launches failed silently. | Primary UTF-16LE/BOM/CRLF .rdp download, sanitized fields, explicit fallback, setup guidance, credential prompt, no stored password. |
| Medium | SSH protocol links had no handler on many machines; command-palette routes could open remote addresses as web URLs. | Validated OpenSSH command and Windows/macOS/Linux launch files, explicit protocol fallback, optional authenticated browser terminal. |
| Medium | Editing a prefilled username with a blank password could silently overwrite the existing password. | No prefilled plaintext credentials in entry lists; both blank preserves the pair, filling either replaces it with clear UI wording. |
| Medium | Role enforcement was inconsistent, imports lacked schema validation, arbitrary role strings could partially modify users. | Validated schemas, pre-validation before mutation, editor guards, owner-scoped transactions, consistent JSON errors. |
| Medium | CSP allowed unsafe script execution and unrestricted network sources; fonts depended on Google CDN. | Self-only scripts, bounded connections, local fonts/assets, strict headers, no-store API responses. |
| Medium | Desktop/mobile navigation, keyboard labels, custom-category editing, and failure feedback were incomplete. | Responsive sidebar/rail, saved display settings, native modal focus behavior plus drawer focus handling, field labels, empty states, and errors. |

## Restored original interaction capabilities

Per-resource ping, batch ping, compact/expanded cards, individual expansion, and desktop/mobile sidebar controls are retained in the new theme. Display preferences persist per account. Collapsing a card keeps launch, favorite, and Ping controls available.

## Verification and platform limits

- `npm test`: eleven tests pass, covering security/ownership, encryption, account lockout, session expiry, authentication, launch files, and backup recovery.
- `npm run build`: production frontend build verified on Windows with Node.js 24.
- Browser checks use an isolated fixture on `127.0.0.1:8444`: login, resource creation, offline icon search/selection, card/sidebar controls, and themes.
- RDP file tests verify encoding, attachment headers, target/port and absence of passwords. SSH tests validate command construction and reject shell/option injection.
- A local SSH server integration test verifies fingerprint-checked terminal input/output and rejects untrusted WebSocket origins and reused connection tickets.
- Windows, Linux, and macOS launcher **file formats** are generated and checked. Live remote sessions through installed native RDP/SSH/AnyDesk/RustDesk clients on all three OSes have not been exercised. Client installation, protocol registration, network access, server identity, and target credentials remain deployment-dependent.
- WebAuthn requires a real authenticator for a full device ceremony; hardware-specific passkey compatibility is not claimed as tested.
- Docker CLI is installed but Docker Engine was unavailable; container build/run could not be verified here.

## Remaining trust and operational risks

- Password-derived server-side encryption is not zero-knowledge against a compromised host. A host operator can change the program or capture passwords in memory. Legacy records remain server-key-encrypted until their owners complete a password login. Protect and retire migration snapshots under a retention policy.
- Application admins cannot reset another account’s password. Direct host/database administrators remain trusted and can read unencrypted metadata or modify the running application.
- SQLite and the audit log remain writable to the OS account running the app. Forward audit events externally if tamper-evident retention is required.
- Clipboard history/sync and browsers refusing background clipboard access cannot be cleared reliably by a web app.
- TCP probes intentionally reach configured private networks. Restrict network egress and account creation. A reachable TCP port does not prove service health.
- Native client launches cannot be guaranteed by a browser. Downloaded scripts require deliberate opening/execution, and operating-system protections may require approval.
- Backups briefly create a local plaintext SQLite snapshot. Deletion is not secure erasure; use encrypted disks and restricted data directories.
- In-memory rate limits and vault objects are designed for one application instance. Horizontal scaling needs shared coordination.
- No claim of future-proof cryptography or vulnerability-free code is made. Independent review is recommended before storing production credentials.

## Privacy hardening — 2026-10-01

Removed application-admin password resets, which previously allowed metadata impersonation. Activity logs now use immutable actor IDs and are private to each user; unowned legacy events are retained for host-level review only. Admin mutations require recent password confirmation. Asynchronous password and passkey completion re-checks account/session revocation and passkey state before committing. Production dependency audit reports zero known vulnerabilities at this review; this is not proof that no vulnerabilities exist. Review follows [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Connection and vault verification — 2026-10-01

Eleven automated tests pass. Added personal-vault encrypted roundtrip, wrong-password/tamper rejection, ownership isolation, per-user layout persistence, native launch URL validation, and extension origin/form checks. Windows launcher compilation and dry-run destination validation passed; current-user protocol registration was verified. RDP Connect now invokes the installed bridge and never downloads a file; only the explicit Download link does. UI checks verified List/Comfortable layouts and encrypted vault controls in a disposable workspace. Actual remote authentication was not exercised. Chrome extension installation remains manual because browser automation blocks internal extension-management pages; real website login is not claimed verified.
