import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/app.js";
import { configuration } from "../server/config.js";
import { digest } from "../server/security.js";
import { pingEntry } from "../server/ping.js";

test("account lockout, disabled users, viewer roles, idle and absolute session expiry", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zaddesh-auth-"));
  const password = "Authentication-Test123!",
    config = configuration({
      VAULT_SECRET: randomBytes(48).toString("hex"),
      INITIAL_ADMIN_PASSWORD: password,
      DATA_DIR: directory,
      APP_ORIGIN: "http://localhost:8443",
    });
  const runtime = await createApp(config);
  runtime.db.exec("UPDATE users SET must_change=0");
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    runtime.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const login = async (value) => {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: config.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: value }),
    });
    return { r, data: await r.json() };
  };
  for (let i = 0; i < 5; i++)
    assert.equal((await login("incorrect-password")).r.status, 401);
  assert.equal(
    (await login(password)).r.status,
    401,
    "Correct password cannot bypass an active lockout",
  );
  runtime.db.exec("UPDATE users SET locked_until=0,failures=0");
  let auth = await login(password);
  assert.equal(auth.r.status, 200);
  let cookie = auth.r.headers
    .getSetCookie()
    .find((c) => c.startsWith("zd_sid="))
    .split(";")[0];
  const headers = () => ({
    Cookie: cookie,
    Origin: config.origin,
    "x-csrf-token": auth.data.csrf,
    "Content-Type": "application/json",
  });
  let id = digest(cookie.slice(7));
  runtime.db
    .prepare("UPDATE sessions SET touched=? WHERE id=?")
    .run(Date.now() - config.idleMs - 1, id);
  assert.equal(
    (await fetch(base + "/api/entries", { headers: headers() })).status,
    401,
  );
  auth = await login(password);
  cookie = auth.r.headers
    .getSetCookie()
    .find((c) => c.startsWith("zd_sid="))
    .split(";")[0];
  id = digest(cookie.slice(7));
  runtime.db
    .prepare("UPDATE sessions SET created=? WHERE id=?")
    .run(Date.now() - config.maxMs - 1, id);
  assert.equal(
    (await fetch(base + "/api/entries", { headers: headers() })).status,
    401,
  );
  auth = await login(password);
  cookie = auth.r.headers
    .getSetCookie()
    .find((c) => c.startsWith("zd_sid="))
    .split(";")[0];
  runtime.db.exec("UPDATE users SET role='Viewer'");
  assert.equal(
    (
      await fetch(base + "/api/entries", {
        headers: headers(),
        method: "POST",
        body: JSON.stringify({
          name: "Attempt",
          address: "https://example.com",
          category: "Test",
        }),
      })
    ).status,
    403,
  );
  assert.equal(
    (await fetch(base + "/api/users", { headers: headers() })).status,
    403,
  );
  runtime.db.exec("UPDATE users SET disabled=1");
  assert.equal(
    (await fetch(base + "/api/entries", { headers: headers() })).status,
    401,
  );
  assert.equal((await login(password)).r.status, 401);
});

test("reachability checks reject metadata/loopback and distinguish non-IP remote IDs", async () => {
  for (const address of [
    "http://169.254.169.254",
    "http://127.0.0.1",
    "http://[::1]",
  ]) {
    const r = await pingEntry(address, "web");
    assert.equal(r.online, null);
    assert.match(r.error, /blocked/);
  }
  const r = await pingEntry("123456789", "anydesk");
  assert.equal(r.online, null);
  assert.match(r.error, /remote ID/);
});
