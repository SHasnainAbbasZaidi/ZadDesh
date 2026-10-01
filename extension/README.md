# Direct login browser extension

Use Chrome or Edge; the Codex in-app browser does not support this extension. Installation is manual because browser automation cannot access extension-management pages. No password is stored by this extension.

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) yourself.
2. Enable Developer mode, choose **Load unpacked**, and select this `extension` folder.
3. Open the extension popup. Enter your exact ZadDesh address (for this computer, `http://localhost:8443`) and click **Connect dashboard**. Approve its site permission.
4. Enter a destination website URL and click **Allow this website**. Approve its site permission. Repeat for each desired website. Exact origins, including ports, are checked in addition to Chrome's host permission.
5. Reload ZadDesh in that same browser, save credentials on a web entry, and click its card. Confirm your ZadDesh password, then choose **Log in with saved credentials**.

The extension opens the entry URL, fills one visible password field and a recognizable username field, and submits a same-origin HTTPS POST form. It rejects HTTP destinations, cross-origin redirects, GET forms (which could expose passwords in URLs), password-change forms, ambiguous inputs, and cross-origin submit overrides. It does not bypass MFA, CAPTCHA, SSO, certificate warnings, or multi-step/custom login interfaces. Those require manual interaction or a service-specific integration. It cannot guarantee direct login to every web link.

Credentials exist temporarily in browser memory and in the destination login form. They are never saved in extension storage, URLs, or files. The configured dashboard and permitted exact origins are stored locally. Website scripts at the approved destination can read their own login form, as with manually entered credentials. Remove the extension to revoke its permissions; reloading an unpacked extension is needed after source updates.

Browser installation and real third-party login ceremonies still require validation on the user's machine. Automated tests cover the extension's origin/permission checks and form filling/submission logic using controlled fixtures.
