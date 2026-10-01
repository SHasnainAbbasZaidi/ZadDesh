# Publication preparation

These notes provide suggested GitHub copy and checks before a public release. Publishing repository changes, changing repository visibility, and choosing a license are separate decisions.

## Suggested repository description

Self-hosted infrastructure dashboard with private workspaces, encrypted credentials, remote-client launching, customizable layouts, and local icons.

## Suggested topics

`self-hosted`, `dashboard`, `homelab`, `sysadmin`, `infrastructure`, `react`, `nodejs`, `sqlite`, `docker`, `rdp`, `ssh`

## Announcement draft

**Meet ZadDesh: your infrastructure in one private workspace.**

ZadDesh brings hosting panels, firewalls, monitoring tools, inventory systems, cloud consoles, and remote machines into one searchable dashboard. It is built for homelab owners, system administrators, hosting operators, and support teams who want fewer scattered bookmarks and faster access to everyday tools.

Choose compact cards, comfortable cards, or a list; collapse details and the sidebar; and personalize the workspace with light/dark themes and accent colors. The application includes 216 local icons, favorites, category filters, TCP reachability checks, encrypted personal vault import/export, and individual accounts with private resources.

Remote access includes a Windows RDP/SSH launcher, AnyDesk/RustDesk links, explicit connection-file downloads, and optional browser SSH. A separately installed Chrome/Edge extension supports saved-credential login on compatible approved HTTPS forms. Native clients require local setup, and automatic login does not bypass MFA or work on every website.

Self-host with Node.js 24 and SQLite or the included Docker configuration, behind an HTTPS reverse proxy. The documentation explains first login, configuration, backups, recovery, upgrades, and practical security limits.

**Mahzaidex Tech · Developed by Hasnain Zaidi**

[Explore ZadDesh](https://github.com/SHasnainAbbasZaidi/ZadDesh) · [Read the setup guide](SELF_HOSTING.md)

## Screenshot and branding

Use [the demo dashboard image](images/dashboard.png) and the bundled [logo](../public/brand/logo.svg). The screenshot contains sample resources rather than live infrastructure. Do not substitute production screenshots without reviewing account names, private hostnames, IP addresses, and visible credentials.

Vendor trademarks and icons do not imply endorsement. Retain [third-party notices](../THIRD_PARTY_NOTICES.md).

## Before publishing

- Review the README and both guides, including supported-platform and direct-login limitations.
- Select an appropriate project license before describing the repository as open source. No license has been chosen in this change.
- Review tracked files and Git history for secrets, real infrastructure details, internal reference images, database files, archives, and sensitive logs. `.gitignore` does not remove already tracked or historical data. Rotate any previously exposed secrets.
- Keep `.env`, SQLite files, `.zdb`/`.zdvault` archives, private keys, and actual temporary admin passwords out of the repository and screenshots.
- Run `npm test` and `npm run build` for the release revision. Validate Docker deployment, backup restoration, passkeys, and native/third-party login paths in the environments you intend to support.
- Establish a private vulnerability-reporting channel, such as GitHub private vulnerability reporting, before announcing a security-reporting process. Do not ask users to post secrets in public issues.
- Review [AUDIT.md](../AUDIT.md), [migration notes](../MIGRATION.md), and [security practices](SELF_HOSTING.md#production-security-practices). Do not describe development-time testing as independent security certification.
- Review the final diff before committing and pushing. Changing visibility to public deserves a separate review of the entire repository history.

## Scope of this documentation update

This update prepares overview copy, a demo screenshot, user instructions, and self-hosting guidance. It does not change application behavior, choose a license, publish a release, or change repository visibility. Existing implementation limitations remain documented rather than advertised as completed capabilities.
