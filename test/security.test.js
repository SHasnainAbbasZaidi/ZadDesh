import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.js";
import { configuration } from "../server/config.js";
import {
  createVault,
  entrySchema,
  validCustomIcon,
} from "../server/security.js";
import { encryptedSnapshot, restoreSnapshot } from "../server/backup.js";
import { generateRdpContent } from "../server/rdp.js";
import * as OTPAuth from "otpauth";
import {
  sshCommand,
  sshLaunchFile,
  launchProtocol,
  parseRemote,
} from "../shared/launch.js";

const initial = "TemporaryPassword123!",
  pass = "PrivatePassword456!",
  next = "DifferentPassword789!";
test("vault encryption uses unique nonces, authenticated context, and password-derived keys", () => {
  const a = createVault(pass, "salt-a"),
    b = createVault(next, "salt-a");
  const one = a.encrypt({ password: "private-secret" }, "user:1:entry:1"),
    two = a.encrypt({ password: "private-secret" }, "user:1:entry:1");
  assert.notEqual(one, two);
  assert.ok(!one.includes("private-secret"));
  assert.deepEqual(a.decrypt(one, "user:1:entry:1"), {
    password: "private-secret",
  });
  assert.throws(() => b.decrypt(one, "user:1:entry:1"));
  assert.throws(() => a.decrypt(one, "user:2:entry:1"));
  assert.throws(() => a.decrypt(one.slice(0, -3) + "AAA", "user:1:entry:1"));
});
test("validation rejects active URLs, malformed remote targets, and active SVG uploads", () => {
  const base = { name: "Host", category: "Remote", icon: "server" };
  for (const address of [
    "javascript:alert(1)",
    "https://name:secret@example.com",
  ])
    assert.equal(
      entrySchema.safeParse({ ...base, address, method: "web" }).success,
      false,
    );
  assert.equal(
    entrySchema.safeParse({
      ...base,
      address: "host\r\npassword 51:b:bad",
      method: "rdp",
    }).success,
    false,
  );
  assert.equal(
    validCustomIcon(
      "data:image/svg+xml;base64," +
        Buffer.from('<svg onload="alert(1)"></svg>').toString("base64"),
    ),
    false,
  );
  const rdp = generateRdpContent(
    { address: "host:3390" },
    { username: "user\r\nmalicious", password: "never-write-this" },
  );
  assert.ok(rdp.includes("full address:s:host:3390\r\n"));
  assert.ok(rdp.includes("prompt for credentials:i:1"));
  assert.ok(!rdp.includes("never-write-this"));
  assert.ok(!rdp.includes("\r\nmalicious"));
});
test("native SSH launchers preserve destination and port without shell injection or passwords", () => {
  const address = "alice@server.example.com:2222";
  assert.equal(
    sshCommand(address),
    'ssh -p 2222 -l "alice" "server.example.com"',
  );
  assert.match(sshLaunchFile(address, "windows").content, /@echo off\r\n/);
  assert.equal(sshLaunchFile(address, "mac").extension, "command");
  assert.equal(sshLaunchFile(address, "linux").extension, "sh");
  assert.equal(
    launchProtocol({ method: "ssh", address }),
    "ssh://alice@server.example.com:2222",
  );
  assert.equal(
    launchProtocol({ method: "rdp", address: "host" }),
    "rdp://host:3389",
  );
  assert.equal(
    launchProtocol({ method: "anydesk", address: "123 456 789" }),
    "anydesk:123456789",
  );
  assert.equal(
    launchProtocol({ method: "rustdesk", address: "123456789" }),
    "rustdesk://123456789",
  );
  for (const value of [
    "-oProxyCommand=evil",
    "host & whoami",
    "user@host:99999",
    "host\nwhoami",
    "$(command)",
  ])
    assert.throws(() => parseRemote(value));
});
test("private dashboards, session security, MFA, re-keying and safe backup roundtrip", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "zaddesh-test-"));
  const cfg = configuration({
    VAULT_SECRET: "test-only-server-secret-that-is-long-enough",
    INITIAL_ADMIN_PASSWORD: initial,
    DATA_DIR: dataDir,
    APP_ORIGIN: "http://localhost:8443",
  });
  const runtime = await createApp(cfg),
    server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    runtime.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  function client() {
    let cookie = "",
      csrf = "";
    return {
      async call(
        route,
        body,
        method = body === undefined ? "GET" : "POST",
        extra = {},
      ) {
        const res = await fetch(base + route, {
          method,
          headers: {
            Origin: cfg.origin,
            "Content-Type": "application/json",
            Cookie: cookie,
            "x-csrf-token": csrf,
            ...extra,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const set = res.headers
          .getSetCookie()
          .find((c) => c.startsWith("zd_sid="));
        if (set) cookie = set.split(";")[0];
        const content = res.headers.get("content-type") || "";
        const value = content.includes("json")
          ? await res.json()
          : await res.text();
        if (value.csrf) csrf = value.csrf;
        return { status: res.status, data: value, headers: res.headers };
      },
      cookie: () => cookie,
    };
  }
  const admin = client(),
    a = client(),
    b = client();
  let r = await admin.call("/api/auth/login", {
    username: "admin",
    password: initial,
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal((await admin.call("/api/entries")).status, 403);
  r = await admin.call("/api/auth/change-password", {
    currentPassword: initial,
    newPassword: pass,
  });
  assert.equal(r.status, 200);
  assert.equal((await admin.call("/api/entries")).data.entries.length, 0);
  assert.equal(
    (
      await admin.call("/api/users", {
        username: "denied",
        password: initial,
        role: "Editor",
      })
    ).status,
    403,
  );
  assert.equal(
    (await admin.call("/api/auth/reauth", { password: pass })).status,
    200,
  );
  for (const username of ["alice", "bob"])
    assert.equal(
      (
        await admin.call("/api/users", {
          username,
          password: initial,
          role: "Editor",
        })
      ).status,
      201,
    );
  for (const [c, username] of [
    [a, "alice"],
    [b, "bob"],
  ]) {
    assert.equal(
      (await c.call("/api/auth/login", { username, password: initial })).status,
      200,
    );
    assert.equal(
      (
        await c.call("/api/auth/change-password", {
          currentPassword: initial,
          newPassword: pass,
        })
      ).status,
      200,
    );
  }
  const aliceId = (await a.call("/api/auth/me")).data.user.id;
  const entry = {
    name: "Private RDP",
    address: "private.example:3389",
    category: "Remote",
    icon: "rdp",
    method: "rdp",
    description: "private dashboard",
    credentials: {
      username: "alice-on-server",
      password: "secret-target-password",
    },
  };
  const created = await a.call("/api/entries", entry);
  assert.equal(created.status, 201);
  const id = created.data.id;
  const profileResponse = await fetch(base + `/api/entries/${id}/rdp`, {
    headers: { Cookie: a.cookie() },
  });
  assert.equal(profileResponse.status, 200);
  assert.match(
    profileResponse.headers.get("content-disposition"),
    /attachment; filename="Private_RDP.rdp"/,
  );
  const profile = Buffer.from(await profileResponse.arrayBuffer()).toString(
    "utf16le",
  );
  assert.ok(profile.startsWith("\ufeff"));
  assert.ok(profile.includes("full address:s:private.example:3389\r\n"));
  assert.ok(!profile.includes("secret-target-password"));
  for (const intruder of [b, admin]) {
    assert.equal((await intruder.call("/api/entries")).data.entries.length, 0);
    for (const [route, body, method] of [
      [`/api/entries/${id}`, undefined, "GET"],
      [`/api/entries/${id}`, entry, "PUT"],
      [`/api/entries/${id}`, undefined, "DELETE"],
      [`/api/entries/${id}/reveal`, { password: pass }, "POST"],
      [`/api/entries/${id}/rdp`, undefined, "GET"],
      [`/api/entries/${id}/ssh-connect`, {}, "POST"],
      [`/api/favorites/${id}`, {}, "POST"],
      ["/api/entries/reorder", { order: [id] }, "POST"],
      ["/api/ping", { id }, "POST"],
    ])
      assert.equal(
        (await intruder.call(route, body, method)).status,
        404,
        `${route} isolates ownership`,
      );
    assert.equal(
      (await intruder.call("/api/backup/export")).data.entries.length,
      0,
    );
  }
  assert.equal((await a.call(`/api/entries/${id}/reveal`, {})).status, 403);
  r = await a.call(`/api/entries/${id}/reveal`, { password: pass });
  assert.equal(r.data.password, "secret-target-password");
  const encrypted = runtime.db
    .prepare("SELECT vault FROM entries WHERE id=?")
    .get(id).vault;
  assert.ok(!encrypted.includes("secret-target-password"));
  assert.equal(
    (await a.call("/api/entries", entry, "POST", { "x-csrf-token": "" }))
      .status,
    403,
  );
  assert.equal(
    (
      await a.call("/api/entries", entry, "POST", {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  const exported = await a.call("/api/backup/export");
  assert.equal(exported.data.entries.length, 1);
  assert.equal(exported.data.entries[0].vault, undefined);
  assert.equal(exported.data.entries[0].credentials, undefined);
  assert.equal((await b.call("/api/backup/import", exported.data)).status, 200);
  assert.equal(
    (await b.call("/api/entries")).data.entries[0].hasCredentials,
    false,
  );
  assert.equal(
    (await a.call("/api/settings", { theme: "light", accent: "cyan" }, "PUT"))
      .status,
    200,
  );
  assert.deepEqual((await b.call("/api/settings")).data, {});
  assert.equal(
    (
      await a.call(
        "/api/settings",
        { sidebarCollapsed: true, cardView: "expanded" },
        "PUT",
      )
    ).status,
    200,
  );
  assert.deepEqual((await a.call("/api/settings")).data, {
    theme: "light",
    accent: "cyan",
    sidebarCollapsed: true,
    cardView: "expanded",
  });
  const oldSession = client();
  await oldSession.call("/api/auth/login", {
    username: "alice",
    password: pass,
  });
  assert.equal(
    (
      await a.call("/api/auth/change-password", {
        currentPassword: pass,
        newPassword: next,
      })
    ).status,
    200,
  );
  assert.equal((await oldSession.call("/api/entries")).status, 401);
  assert.equal(
    (await a.call(`/api/entries/${id}/reveal`, { password: next })).data
      .password,
    "secret-target-password",
  );
  assert.notEqual(
    runtime.db.prepare("SELECT vault FROM entries WHERE id=?").get(id).vault,
    encrypted,
  );
  assert.equal(
    (await a.call("/api/auth/reauth", { password: next })).status,
    200,
  );
  r = await a.call("/api/auth/totp/setup", {});
  assert.equal(r.status, 200);
  const otp = new OTPAuth.TOTP({ secret: r.data.secret });
  assert.equal(
    (await a.call("/api/auth/totp/verify", { token: otp.generate() })).status,
    200,
  );
  const unauth = client();
  assert.equal(
    (
      await unauth.call("/api/auth/login", {
        username: "alice",
        password: next,
        totpCode: otp.generate(),
      })
    ).status,
    401,
    "TOTP replay rejected",
  );
  assert.ok(
    runtime.db
      .prepare("SELECT totp FROM users WHERE id=?")
      .get(aliceId)
      .totp.includes("."),
  );
  const backup = path.join(dataDir, "backup.zdb"),
    restored = path.join(dataDir, "restored.sqlite");
  encryptedSnapshot(runtime.db, backup, "Backup-Only-Password123!");
  assert.ok(!fs.readFileSync(backup, "utf8").includes("Private RDP"));
  assert.throws(() =>
    restoreSnapshot(backup, restored, "Incorrect-Password123!"),
  );
  assert.equal(fs.existsSync(restored), false);
  restoreSnapshot(backup, restored, "Backup-Only-Password123!");
  const restoredDb = new DatabaseSync(restored);
  assert.equal(
    restoredDb.prepare("SELECT count(*) AS n FROM sessions").get().n,
    0,
  );
  assert.equal(
    restoredDb.prepare("SELECT count(*) AS n FROM entries").get().n,
    2,
  );
  restoredDb.close();
  await admin.call("/api/auth/reauth", { password: pass });
  const vaultBefore = runtime.db
    .prepare("SELECT vault FROM entries WHERE id=?")
    .get(id).vault;
  for (const body of [
    { password: initial },
    { password: initial, confirmVaultLoss: true },
  ])
    assert.equal(
      (await admin.call(`/api/users/${aliceId}`, body, "PUT")).status,
      403,
    );
  assert.equal(
    runtime.db.prepare("SELECT vault FROM entries WHERE id=?").get(id).vault,
    vaultBefore,
  );
  runtime.db
    .prepare("INSERT INTO audit(at,actor,action,target,ip) VALUES(?,?,?,?,?)")
    .run(
      new Date().toISOString(),
      "admin",
      "LEGACY_PRIVATE",
      "legacy-secret",
      "",
    );
  const adminLogs = (await admin.call("/api/audit")).data.logs;
  assert.ok(adminLogs.length > 0);
  assert.ok(
    adminLogs.every(
      (log) => log.actor === "admin" && log.target !== "legacy-secret",
    ),
  );
  const bobLogs = (await b.call("/api/audit")).data.logs;
  assert.ok(bobLogs.length > 0);
  assert.ok(bobLogs.every((log) => log.actor === "bob"));
  assert.equal((await admin.call("/api/audit?page=1.5")).status, 400);
  const bobSession = b.cookie();
  assert.equal((await b.call("/api/auth/logout", {})).status, 200);
  assert.equal(
    (await fetch(base + "/api/entries", { headers: { Cookie: bobSession } }))
      .status,
    401,
  );
  assert.match(
    (await fetch(base + "/healthz")).headers.get("content-security-policy"),
    /script-src 'self'/,
  );
});
