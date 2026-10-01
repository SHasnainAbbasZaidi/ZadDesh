import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import ssh2 from "ssh2";
const { Server, utils } = ssh2;
import WebSocket from "ws";

test("browser SSH verifies host key, rejects wrong origin and ticket replay, and exchanges terminal data", async (t) => {
  const key = crypto
    .generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ type: "pkcs1", format: "pem" });
  const fingerprint =
    "SHA256:" +
    crypto
      .createHash("sha256")
      .update(utils.parseKey(key).getPublicSSH())
      .digest("base64")
      .replace(/=+$/, "");
  const connections = new Set();
  const ssh = new Server({ hostKeys: [key] }, (client) => {
    connections.add(client);
    client.on("close", () => connections.delete(client));
    client.on("error", () => {});
    client.on("authentication", (ctx) =>
      ctx.method === "password" &&
      ctx.username === "tester" &&
      ctx.password === "target-test-pass"
        ? ctx.accept()
        : ctx.reject(),
    );
    client.on("ready", () =>
      client.on("session", (accept) => {
        const session = accept();
        session.on("pty", (accept) => accept?.());
        session.on("shell", (accept) => {
          const stream = accept();
          stream.write("TEST-SHELL-READY");
          stream.on("data", (data) => stream.write(data));
        });
      }),
    );
  });
  await new Promise((r) => ssh.listen(0, "127.0.0.1", r));
  const port = ssh.address().port;
  process.env.SSH_TARGETS_JSON = JSON.stringify({
    [`127.0.0.1:${port}`]: fingerprint,
  });
  const { createApp } = await import("../server/app.js"),
    { configuration } = await import("../server/config.js"),
    { attachSshProxy } = await import("../server/ssh-proxy.js");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zaddesh-ssh-"));
  const config = configuration({
    VAULT_SECRET: crypto.randomBytes(48).toString("hex"),
    INITIAL_ADMIN_PASSWORD: "Ssh-Test-Password123!",
    DATA_DIR: directory,
    APP_ORIGIN: "http://localhost:8443",
  });
  const runtime = await createApp(config);
  runtime.db.exec("UPDATE users SET must_change=0");
  const http = runtime.app.listen(0, "127.0.0.1");
  await new Promise((r) => http.once("listening", r));
  const wss = attachSshProxy(http, config, runtime.db),
    base = `http://127.0.0.1:${http.address().port}`;
  t.after(async () => {
    for (const ws of wss.clients) ws.terminate();
    for (const c of connections) c.end();
    await new Promise((r) => http.close(r));
    await new Promise((r) => ssh.close(r));
    runtime.close();
    fs.rmSync(directory, { recursive: true, force: true });
    delete process.env.SSH_TARGETS_JSON;
  });
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { Origin: config.origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "admin",
      password: "Ssh-Test-Password123!",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
      .getSetCookie()
      .find((c) => c.startsWith("zd_sid="))
      .split(";")[0],
    csrf = (await login.json()).csrf;
  const post = async (route, body) => {
    const r = await fetch(base + route, {
      method: "POST",
      headers: {
        Origin: config.origin,
        Cookie: cookie,
        "x-csrf-token": csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  const entry = await post("/api/entries", {
    name: "Local SSH fixture",
    address: `tester@127.0.0.1:${port}`,
    category: "Test",
    method: "ssh",
    icon: "ssh",
    credentials: { username: "tester", password: "target-test-pass" },
  });
  assert.equal(entry.status, 201);
  const ticket = await post(`/api/entries/${entry.data.id}/ssh-connect`, {
    password: "Ssh-Test-Password123!",
  });
  assert.equal(ticket.status, 200);
  const bad = new WebSocket(
    base.replace("http:", "ws:") + "/ws/ssh?token=" + ticket.data.token,
    { headers: { Cookie: cookie, Origin: "http://untrusted.example" } },
  );
  await new Promise((resolve, reject) => {
    bad.on("error", resolve);
    bad.on("open", () => reject(Error("Wrong-origin socket accepted")));
  });
  const ws = new WebSocket(
    base.replace("http:", "ws:") + "/ws/ssh?token=" + ticket.data.token,
    { headers: { Cookie: cookie, Origin: config.origin } },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("SSH proxy timed out")),
      10000,
    );
    ws.on("error", reject);
    ws.on("message", (message) => {
      const payload = JSON.parse(message.toString());
      if (payload.type === "error") {
        clearTimeout(timeout);
        reject(Error(payload.message));
      }
      if (payload.data?.includes("TEST-SHELL-READY"))
        ws.send(JSON.stringify({ type: "data", data: "PING-TERMINAL" }));
      if (payload.data?.includes("PING-TERMINAL")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  ws.close();
  const replay = new WebSocket(
    base.replace("http:", "ws:") + "/ws/ssh?token=" + ticket.data.token,
    { headers: { Cookie: cookie, Origin: config.origin } },
  );
  await new Promise((resolve, reject) => {
    replay.on("error", resolve);
    replay.on("open", () => reject(Error("Replayed ticket accepted")));
  });
});
