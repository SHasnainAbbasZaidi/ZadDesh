// Isolated UI fixture: no production database or real infrastructure is touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/app.js";
import { configuration } from "../server/config.js";
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "zaddesh-ui-"));
const config = configuration({
  VAULT_SECRET: randomBytes(48).toString("base64url"),
  INITIAL_ADMIN_PASSWORD: "Ui-Test-Only-Password123!",
  APP_ORIGIN: "http://127.0.0.1:8444",
  PORT: "8444",
  DATA_DIR: dataDir,
});
const runtime = await createApp(config);
runtime.db.prepare("UPDATE users SET must_change=0 WHERE id=1").run();
for (const [name, address, category, icon, description, method] of [
  [
    "cPanel",
    "https://cpanel.example.com:2083",
    "Hosting & Cloud",
    "cpanel",
    "Hosting management, simplified.",
    "web",
  ],
  [
    "Cloudflare",
    "https://dash.cloudflare.com",
    "Hosting & Cloud",
    "cloudflare",
    "DNS, edge networking, and protection.",
    "web",
  ],
  [
    "Proxmox VE",
    "https://pve.example.com:8006",
    "Virtualization",
    "proxmox",
    "Your virtual infrastructure, at a glance.",
    "web",
  ],
  [
    "Grafana",
    "https://grafana.example.com",
    "Monitoring",
    "grafana",
    "Metrics that tell the whole story.",
    "web",
  ],
  [
    "Uptime Kuma",
    "https://uptime.example.com",
    "Monitoring",
    "uptimekuma",
    "Keep an eye on every heartbeat.",
    "web",
  ],
  [
    "Windows Server",
    "server.example.com:3389",
    "Remote Access",
    "rdp",
    "A secure connection to your workspace.",
    "rdp",
  ],
])
  runtime.db
    .prepare(
      "INSERT INTO entries(owner_id,name,address,category,icon,description,method,vault_version) VALUES (1,?,?,?,?,?,?,2)",
    )
    .run(name, address, category, icon, description, method);
runtime.db.prepare("INSERT INTO favorites VALUES(1,1)").run();
const server = runtime.app.listen(8444, "127.0.0.1", () =>
  console.log(
    "Isolated UI test fixture: http://127.0.0.1:8444; admin / Ui-Test-Only-Password123!",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      runtime.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
      process.exit(0);
    }),
  );
