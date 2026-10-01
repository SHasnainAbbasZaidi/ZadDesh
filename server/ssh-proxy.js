import { Client } from "ssh2";
import { WebSocketServer } from "ws";
import dns from "node:dns/promises";
import crypto from "node:crypto";
import { token, digest } from "./security.js";

// Explicit host:port -> OpenSSH SHA256 host-key fingerprint map. Empty disables the proxy.
const targets = JSON.parse(process.env.SSH_TARGETS_JSON || "{}");
const tickets = new Map();
export async function issueSshTicket(address, credentials, sessionId) {
  const match = /^(?:([^@]+)@)?(\[[a-fA-F0-9:]+\]|[^:]+)(?::(\d+))?$/.exec(
    address,
  );
  if (!match) throw Error("Invalid SSH target.");
  const host = match[2].replace(/^\[|\]$/g, ""),
    port = Number(match[3] || 22),
    fingerprint = targets[`${host}:${port}`];
  if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint || ""))
    throw Error(
      "This SSH destination has no configured host-key fingerprint. Use the desktop handler.",
    );
  const resolved = await dns.lookup(host);
  const id = token();
  tickets.set(id, {
    host: resolved.address,
    port,
    username: credentials.username || match[1],
    password: credentials.password,
    fingerprint,
    sessionId,
    expires: Date.now() + 30000,
  });
  const timer = setTimeout(() => tickets.delete(id), 30000);
  timer.unref();
  return id;
}
export function attachSshProxy(server, config, db) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  function validSession(id) {
    const s = db
      .prepare(
        "SELECT s.*,u.disabled,u.must_change FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?",
      )
      .get(id);
    return (
      s &&
      !s.disabled &&
      !s.must_change &&
      Date.now() - s.touched < config.idleMs &&
      Date.now() - s.created < config.maxMs
    );
  }
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/ws/ssh" || req.headers.origin !== config.origin) {
      socket.destroy();
      return;
    }
    const raw = req.headers.cookie
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("zd_sid="))
        ?.slice(7),
      sid = raw ? digest(raw) : "";
    const id = url.searchParams.get("token"),
      ticket = tickets.get(id);
    tickets.delete(id);
    if (
      !ticket ||
      ticket.expires < Date.now() ||
      ticket.sessionId !== sid ||
      !validSession(sid)
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = new Client();
      let stream;
      const send = (payload) => {
        if (ws.readyState === 1) {
          if (ws.bufferedAmount > 1024 * 1024) {
            ws.close(1009, "Output too large");
            return;
          }
          ws.send(JSON.stringify(payload));
        }
      };
      const cleanup = setInterval(() => {
        if (!validSession(sid)) ws.close(4001, "Session expired");
      }, 5000);
      cleanup.unref();
      ws.on("close", () => {
        clearInterval(cleanup);
        conn.end();
      });
      ws.on("error", () => conn.end());
      ws.on("message", (message) => {
        try {
          const p = JSON.parse(message.toString());
          if (
            p.type === "data" &&
            typeof p.data === "string" &&
            p.data.length < 32768
          )
            stream?.write(p.data);
          if (
            p.type === "resize" &&
            Number.isInteger(p.rows) &&
            Number.isInteger(p.cols) &&
            p.rows > 0 &&
            p.rows < 300 &&
            p.cols > 0 &&
            p.cols < 500
          )
            stream?.setWindow(p.rows, p.cols, 0, 0);
        } catch {
          ws.close(1007, "Invalid terminal message");
        }
      });
      conn.on("ready", () =>
        conn.shell({ term: "xterm-256color", cols: 80, rows: 24 }, (err, s) => {
          if (err) {
            send({ type: "error", message: "Unable to open shell." });
            ws.close();
            return;
          }
          stream = s;
          send({
            type: "status",
            message: "\r\nConnected. Host key verified.\r\n",
          });
          s.on("data", (data) =>
            send({ type: "data", data: data.toString("utf8") }),
          );
          s.on("close", () => ws.close());
        }),
      );
      conn.on("error", () => {
        send({
          type: "error",
          message:
            "SSH authentication, host verification, or connection failed.",
        });
        ws.close();
      });
      conn.on("close", () => ws.close());
      conn.connect({
        host: ticket.host,
        port: ticket.port,
        username: ticket.username,
        password: ticket.password,
        readyTimeout: 10000,
        keepaliveInterval: 15000,
        hostVerifier: (key) => {
          const actual =
            "SHA256:" +
            crypto
              .createHash("sha256")
              .update(key)
              .digest("base64")
              .replace(/=+$/, "");
          return actual === ticket.fingerprint;
        },
      });
    });
  });
  return wss;
}
