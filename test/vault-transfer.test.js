import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/app.js";
import { configuration } from "../server/config.js";
import { hashPassword, token } from "../server/security.js";
import { desktopProtocol } from "../shared/launch.js";
test("personal vault roundtrip, wrong-key/tamper rejection, owner isolation and layout persistence", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-transfer-"));
  const password = "Private-Account-Password123!",
    archivePassword = "Archive-Password-Test123!";
  const config = configuration({
    VAULT_SECRET: randomBytes(48).toString("hex"),
    INITIAL_ADMIN_PASSWORD: password,
    DATA_DIR: dir,
    APP_ORIGIN: "http://localhost:8443",
  });
  const runtime = await createApp(config);
  runtime.db.exec("UPDATE users SET must_change=0");
  runtime.db
    .prepare(
      "INSERT INTO users(username,password,role,vault_salt,must_change) VALUES(?,?,'Editor',?,0)",
    )
    .run("alice", await hashPassword(password), token());
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    runtime.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function client(username) {
    let cookie = "",
      csrf = "";
    const call = async (route, body, method = body ? "POST" : "GET") => {
      const res = await fetch(base + route, {
        method,
        headers: {
          Origin: config.origin,
          Cookie: cookie,
          "x-csrf-token": csrf,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers
        .getSetCookie()
        .find((c) => c.startsWith("zd_sid="));
      if (set) cookie = set.split(";")[0];
      const data = await res.json();
      if (data.csrf) csrf = data.csrf;
      return { status: res.status, data };
    };
    assert.equal(
      (await call("/api/auth/login", { username, password })).status,
      200,
    );
    return call;
  }
  const alice = await client("alice"),
    admin = await client("admin");
  const entry = {
    name: "Private login",
    address: "https://example.com/login",
    category: "Apps",
    credentials: { username: "private-user", password: "Secret-Target-Value" },
  };
  assert.equal((await alice("/api/entries", entry)).status, 201);
  assert.equal(
    (await alice("/api/vault/export", { password: "wrong", archivePassword }))
      .status,
    403,
  );
  const exported = await alice("/api/vault/export", {
    password,
    archivePassword,
  });
  assert.equal(exported.status, 200);
  assert.ok(!JSON.stringify(exported.data).includes("Secret-Target-Value"));
  const archive = exported.data;
  assert.equal(
    (
      await admin("/api/vault/import", {
        password,
        archivePassword: "Incorrect-Archive-Password123!",
        archive,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await admin("/api/vault/import", {
        password,
        archivePassword,
        archive: {
          ...archive,
          payload: archive.payload.slice(0, -5) + "AAAAA",
        },
      })
    ).status,
    400,
  );
  assert.equal((await admin("/api/entries")).data.entries.length, 0);
  const imported = await admin("/api/vault/import", {
    password,
    archivePassword,
    archive,
  });
  assert.equal(imported.status, 200);
  assert.equal(imported.data.imported, 1);
  const [copy] = (await admin("/api/entries")).data.entries;
  assert.equal(copy.owner_id, 1);
  assert.equal(
    (await admin(`/api/entries/${copy.id}/reveal`, { password })).data.password,
    "Secret-Target-Value",
  );
  assert.equal(
    (await alice(`/api/entries/${copy.id}/reveal`, { password })).status,
    404,
  );
  for (const cardLayout of ["grid", "comfortable", "list"]) {
    assert.equal(
      (await alice("/api/settings", { cardLayout }, "PUT")).status,
      200,
    );
    assert.equal((await alice("/api/settings")).data.cardLayout, cardLayout);
  }
  assert.equal((await admin("/api/settings")).data.cardLayout, undefined);
  assert.equal(
    (await alice("/api/settings", { cardLayout: "unsafe" }, "PUT")).status,
    400,
  );
});
test("desktop launch URL uses validated destination and never an RDP download route", () => {
  assert.equal(
    desktopProtocol({ method: "rdp", address: "server.example:3389" }),
    "zaddesh://rdp/" + Buffer.from("server.example:3389").toString("base64url"),
  );
  assert.throws(() =>
    desktopProtocol({ method: "ssh", address: "host;calc.exe" }),
  );
  assert.equal(
    desktopProtocol({ method: "anydesk", address: "123456789" }),
    "anydesk:123456789",
  );
});
