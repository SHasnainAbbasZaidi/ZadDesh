import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import * as OTPAuth from "otpauth";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {
  hashPassword,
  verifyPassword,
  token,
  digest,
  passwordSchema,
  entrySchema,
  createVault,
} from "./security.js";
import { openDatabase, unlockVault, transaction } from "./db.js";
import { generateRdpContent } from "./rdp.js";
import { fetchFavicon } from "./favicon.js";
import { pingEntry } from "./ping.js";
import { issueSshTicket } from "./ssh-proxy.js";
import { sshLaunchFile } from "../shared/launch.js";

export async function createApp(config) {
  const { db, vault: serverVault } = await openDatabase(config);
  const keys = new Map(); // Password-derived vault objects never persist to disk.
  const app = express();
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'", config.origin.replace(/^http/, "ws")],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: config.secure ? [] : null,
        },
      },
      hsts: config.secure ? { maxAge: 31536000 } : false,
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use((req, res, next) =>
    config.forceHttps && !req.secure
      ? res.status(426).json({ error: "HTTPS is required." })
      : next(),
  );
  app.use(express.json({ limit: "4mb" }));
  app.use(cookieParser());
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many authentication attempts. Try again in 15 minutes.",
    },
  });
  const apiLimit = rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Request limit reached. Please wait a minute." },
  });
  const probeLimit = rateLimit({
    windowMs: 60000,
    limit: 60,
    keyGenerator: (req) => String(req.user.id),
    message: {
      error: "Wait a minute before running more reachability checks.",
    },
  });
  app.use("/api", apiLimit);
  const audit = (req, action, target = "") =>
    db
      .prepare(
        "INSERT INTO audit(at,actor,action,target,ip,actor_id) VALUES (?,?,?,?,?,?)",
      )
      .run(
        new Date().toISOString(),
        req.user?.username || "anonymous",
        action,
        String(target),
        req.ip || "",
        req.user?.id ?? null,
      );
  const cookie = {
    httpOnly: true,
    secure: config.secure,
    sameSite: "strict",
    path: "/",
  };
  const publicUser = (u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    mustChange: !!u.must_change,
    has2fa: !!u.totp,
    browserSsh:
      !!process.env.SSH_TARGETS_JSON && process.env.SSH_TARGETS_JSON !== "{}",
  });
  function revoke(userId) {
    for (const s of db
      .prepare("SELECT id FROM sessions WHERE user_id=?")
      .all(userId))
      keys.delete(s.id);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM challenges WHERE user_id=?").run(userId);
  }
  function session(req, res, user, key) {
    if (req.cookies.zd_sid) {
      const old = digest(req.cookies.zd_sid);
      db.prepare("DELETE FROM sessions WHERE id=?").run(old);
      keys.delete(old);
    }
    const raw = token(),
      id = digest(raw),
      csrf = token(),
      now = Date.now();
    db.prepare(
      "INSERT INTO sessions(id,user_id,csrf,created,touched) VALUES (?,?,?,?,?)",
    ).run(id, user.id, csrf, now, now);
    if (key) keys.set(id, key);
    res.cookie("zd_sid", raw, { ...cookie, maxAge: config.maxMs });
    return { user: publicUser(user), csrf };
  }
  app.use("/api", (req, res, next) => {
    const raw = req.cookies.zd_sid;
    if (raw && typeof raw === "string") {
      const id = digest(raw),
        s = db.prepare("SELECT * FROM sessions WHERE id=?").get(id);
      if (s) {
        const u = db.prepare("SELECT * FROM users WHERE id=?").get(s.user_id);
        if (
          u &&
          !u.disabled &&
          Date.now() - s.touched < config.idleMs &&
          Date.now() - s.created < config.maxMs
        ) {
          req.user = u;
          req.session = s;
          db.prepare("UPDATE sessions SET touched=? WHERE id=?").run(
            Date.now(),
            id,
          );
        } else {
          db.prepare("DELETE FROM sessions WHERE id=?").run(id);
          keys.delete(id);
          res.clearCookie("zd_sid", cookie);
        }
      }
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers.origin !== config.origin)
        return res.status(403).json({ error: "Untrusted request origin." });
      const publicRoutes = [
        "/auth/login",
        "/auth/passkey/login-options",
        "/auth/passkey/login-verify",
      ];
      if (!publicRoutes.includes(req.path) && !req.session)
        return res
          .status(401)
          .json({ error: "Your session expired. Please sign in again." });
      if (
        !publicRoutes.includes(req.path) &&
        (!req.session || req.headers["x-csrf-token"] !== req.session.csrf)
      )
        return res
          .status(403)
          .json({ error: "Invalid CSRF token or expired session." });
    }
    next();
  });
  function auth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Please sign in." });
    if (
      req.user.must_change &&
      ![
        "/api/auth/me",
        "/api/auth/change-password",
        "/api/auth/logout",
      ].includes(req.path)
    )
      return res.status(403).json({
        error: "Change your temporary password first.",
        mustChange: true,
      });
    next();
  }
  const admin = (req, res, next) =>
    req.user.role === "Admin"
      ? next()
      : res.status(403).json({ error: "Administrator role required." });
  const editor = (req, res, next) =>
    req.user.role !== "Viewer"
      ? next()
      : res.status(403).json({ error: "Your dashboard is read-only." });
  const own = (req, res) => {
    const e = db
      .prepare("SELECT * FROM entries WHERE id=? AND owner_id=?")
      .get(Number(req.params.id) || 0, req.user.id);
    if (!e) res.status(404).json({ error: "Entry not found." });
    return e;
  };
  function failLogin(req, user) {
    if (user) req.user = user;
    if (user)
      db.prepare(
        "UPDATE users SET failures=failures+1,locked_until=CASE WHEN failures>=4 THEN ? ELSE locked_until END WHERE id=?",
      ).run(Date.now() + 15 * 60000, user.id);
    audit(req, "AUTH_FAILED");
  }
  const loginSchema = z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(128),
    totpCode: z.string().max(6).optional(),
  });
  const dummyHash = await hashPassword(token());
  function validTotp(user, code) {
    if (!user.totp) return true;
    const secret = user.totp.includes(".")
      ? serverVault.decrypt(user.totp, `totp:${user.id}`)
      : user.totp;
    const delta = new OTPAuth.TOTP({
      secret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    }).validate({ token: code || "", window: 1 });
    const step = Math.floor(Date.now() / 30000) + (delta || 0);
    if (delta === null || step <= user.totp_last) return false;
    const result = db
      .prepare("UPDATE users SET totp_last=? WHERE id=? AND totp_last<?")
      .run(step, user.id, step);
    return !!result.changes;
  }
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const b = loginSchema.parse(req.body),
      u = db
        .prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE")
        .get(b.username);
    const valid = await verifyPassword(u?.password || dummyHash, b.password);
    if (!u || u.disabled || u.locked_until > Date.now() || !valid) {
      failLogin(req, u);
      return res.status(401).json({
        error: "Invalid credentials or account temporarily unavailable.",
      });
    }
    const current = db.prepare("SELECT * FROM users WHERE id=?").get(u.id);
    if (
      !current ||
      current.disabled ||
      current.locked_until > Date.now() ||
      current.password !== u.password ||
      current.totp !== u.totp
    )
      return res.status(401).json({ error: "Account changed. Sign in again." });
    if (current.totp && !b.totpCode) return res.json({ require2fa: true });
    if (!validTotp(current, b.totpCode)) {
      failLogin(req, u);
      return res
        .status(401)
        .json({ error: "Invalid or reused authentication code." });
    }
    const key = unlockVault(db, serverVault, u, b.password);
    if (u.totp && !u.totp.includes("."))
      db.prepare("UPDATE users SET totp=? WHERE id=?").run(
        serverVault.encrypt(u.totp, `totp:${u.id}`),
        u.id,
      );
    db.prepare("UPDATE users SET failures=0,locked_until=0 WHERE id=?").run(
      u.id,
    );
    req.user = current;
    audit(req, "LOGIN");
    res.json(session(req, res, current, key));
  });
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: publicUser(req.user), csrf: req.session.csrf }),
  );
  app.post("/api/auth/logout", auth, (req, res) => {
    keys.delete(req.session.id);
    db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    audit(req, "LOGOUT");
    res.clearCookie("zd_sid", cookie);
    res.json({ ok: true });
  });
  async function confirmPassword(req, res, password) {
    if (
      typeof password !== "string" ||
      password.length > 128 ||
      !(await verifyPassword(req.user.password, password))
    ) {
      audit(req, "REAUTH_FAILED");
      res.status(403).json({
        error: "Re-enter your account password.",
        requireReauth: true,
      });
      return null;
    }
    if (!stillAuthorized(req, res)) return null;
    const current = db
      .prepare("SELECT password,disabled FROM users WHERE id=?")
      .get(req.user.id);
    if (
      !current ||
      current.disabled ||
      current.password !== req.user.password ||
      !db.prepare("SELECT id FROM sessions WHERE id=?").get(req.session.id)
    ) {
      res.status(401).json({ error: "Session revoked." });
      return null;
    }
    const key = unlockVault(db, serverVault, req.user, password);
    keys.set(req.session.id, key);
    return key;
  }
  function stillAuthorized(req, res, requireAdmin = false) {
    const current = db
      .prepare(
        "SELECT u.*,s.created,s.touched FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND u.id=?",
      )
      .get(req.session.id, req.user.id);
    if (
      !current ||
      current.disabled ||
      current.password !== req.user.password ||
      Date.now() - current.touched >= config.idleMs ||
      Date.now() - current.created >= config.maxMs ||
      (requireAdmin && current.role !== "Admin")
    ) {
      res
        .status(401)
        .json({ error: "Account or session changed. Sign in again." });
      return false;
    }
    return true;
  }
  app.post("/api/auth/reauth", auth, authLimit, async (req, res) => {
    if (await confirmPassword(req, res, req.body.password)) {
      db.prepare("UPDATE sessions SET reauth=? WHERE id=?").run(
        Date.now() + 60000,
        req.session.id,
      );
      res.json({ ok: true });
    }
  });
  app.post("/api/auth/change-password", auth, authLimit, async (req, res) => {
    const next = passwordSchema.parse(req.body.newPassword),
      oldKey = await confirmPassword(req, res, req.body.currentPassword);
    if (!oldKey) return;
    if (req.body.currentPassword === next)
      return res.status(400).json({ error: "Choose a different password." });
    const salt = token(),
      newKey = createVault(next, salt),
      hashed = await hashPassword(next);
    if (!stillAuthorized(req, res)) return;
    if (
      db.prepare("SELECT password FROM users WHERE id=?").get(req.user.id)
        ?.password !== req.user.password
    )
      return res.status(409).json({ error: "Account changed. Try again." });
    transaction(db, () => {
      for (const e of db
        .prepare(
          "SELECT id,vault FROM entries WHERE owner_id=? AND vault IS NOT NULL",
        )
        .all(req.user.id)) {
        const context = `user:${req.user.id}:entry:${e.id}`;
        db.prepare("UPDATE entries SET vault=? WHERE id=? AND owner_id=?").run(
          newKey.encrypt(oldKey.decrypt(e.vault, context), context),
          e.id,
          req.user.id,
        );
      }
      db.prepare(
        "UPDATE users SET password=?,vault_salt=?,must_change=0 WHERE id=?",
      ).run(hashed, salt, req.user.id);
      revoke(req.user.id);
    });
    req.user.must_change = 0;
    audit(req, "PASSWORD_CHANGED");
    res.json({
      ...session(req, res, req.user, newKey),
      message: "Password changed and vault re-encrypted.",
    });
  });
  const recent = (req, res, next) =>
    req.session.reauth > Date.now()
      ? next()
      : res
          .status(403)
          .json({ error: "Confirm your password first.", requireReauth: true });
  function putChallenge(id, userId, kind, value) {
    db.prepare("DELETE FROM challenges WHERE expires<?").run(Date.now());
    db.prepare("INSERT OR REPLACE INTO challenges VALUES (?,?,?,?,?)").run(
      id,
      userId,
      kind,
      value,
      Date.now() + 120000,
    );
  }
  function takeChallenge(id, kind, userId) {
    const c = db
      .prepare("SELECT * FROM challenges WHERE id=? AND kind=? AND expires>?")
      .get(id, kind, Date.now());
    db.prepare("DELETE FROM challenges WHERE id=?").run(id);
    return c && (userId === undefined || c.user_id === userId) ? c : null;
  }
  app.post("/api/auth/totp/setup", auth, recent, (req, res) => {
    if (req.user.totp)
      return res.status(409).json({
        error: "Disable the existing authenticator before replacing it.",
      });
    const otp = new OTPAuth.TOTP({
      issuer: "ZadDesh",
      label: req.user.username,
      secret: new OTPAuth.Secret({ size: 20 }),
    });
    putChallenge(
      req.session.id,
      req.user.id,
      "totp",
      serverVault.encrypt(otp.secret.base32, `totp:${req.user.id}`),
    );
    res.json({ secret: otp.secret.base32, uri: otp.toString() });
  });
  app.post("/api/auth/totp/verify", auth, authLimit, recent, (req, res) => {
    const c = takeChallenge(req.session.id, "totp", req.user.id);
    if (!c)
      return res.status(400).json({ error: "Setup expired. Start again." });
    const secret = serverVault.decrypt(c.value, `totp:${req.user.id}`),
      otp = new OTPAuth.TOTP({ secret });
    const delta = otp.validate({
      token: String(req.body.token || ""),
      window: 1,
    });
    if (delta === null)
      return res
        .status(400)
        .json({ error: "Invalid code. Start setup again." });
    db.prepare("UPDATE users SET totp=?,totp_last=? WHERE id=?").run(
      c.value,
      Math.floor(Date.now() / 30000) + delta,
      req.user.id,
    );
    audit(req, "TOTP_ENABLED");
    res.json({ ok: true });
  });
  app.post("/api/auth/totp/disable", auth, authLimit, async (req, res) => {
    if (!(await confirmPassword(req, res, req.body.password))) return;
    if (!validTotp(req.user, req.body.totpCode))
      return res
        .status(403)
        .json({ error: "A current authenticator code is required." });
    db.prepare("UPDATE users SET totp=NULL,totp_last=-1 WHERE id=?").run(
      req.user.id,
    );
    audit(req, "TOTP_DISABLED");
    res.json({ ok: true });
  });
  app.post(
    "/api/auth/passkey/register-options",
    auth,
    recent,
    async (req, res) => {
      const options = await generateRegistrationOptions({
        rpName: "ZadDesh",
        rpID: config.rpID,
        userID: Buffer.from(String(req.user.id)),
        userName: req.user.username,
        attestationType: "none",
        excludeCredentials: db
          .prepare("SELECT id FROM passkeys WHERE user_id=?")
          .all(req.user.id),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
      });
      putChallenge(req.session.id, req.user.id, "reg", options.challenge);
      res.json(options);
    },
  );
  app.post(
    "/api/auth/passkey/register-verify",
    auth,
    recent,
    async (req, res) => {
      const c = takeChallenge(req.session.id, "reg", req.user.id);
      if (!c) return res.status(400).json({ error: "Challenge expired." });
      const v = await verifyRegistrationResponse({
        response: req.body.response,
        expectedChallenge: c.value,
        expectedOrigin: config.origin,
        expectedRPID: config.rpID,
        requireUserVerification: true,
      });
      if (!v.verified)
        return res.status(400).json({ error: "Verification failed." });
      if (!stillAuthorized(req, res)) return;
      const p = v.registrationInfo.credential;
      db.prepare("INSERT INTO passkeys VALUES (?,?,?,?,?)").run(
        p.id,
        req.user.id,
        Buffer.from(p.publicKey).toString("base64url"),
        p.counter,
        JSON.stringify(p.transports || []),
      );
      audit(req, "PASSKEY_ADDED");
      res.json({ ok: true });
    },
  );
  app.post("/api/auth/passkey/login-options", authLimit, async (req, res) => {
    const options = await generateAuthenticationOptions({
        rpID: config.rpID,
        userVerification: "required",
      }),
      id = token();
    putChallenge(digest(id), null, "auth", options.challenge);
    res.cookie("zd_challenge", id, { ...cookie, maxAge: 120000 });
    res.json(options);
  });
  app.post("/api/auth/passkey/login-verify", authLimit, async (req, res) => {
    const c = takeChallenge(digest(req.cookies.zd_challenge || ""), "auth");
    res.clearCookie("zd_challenge", cookie);
    const p = db
      .prepare("SELECT * FROM passkeys WHERE id=?")
      .get(String(req.body.response?.id || ""));
    if (!c || !p)
      return res
        .status(400)
        .json({ error: "Invalid or expired passkey request." });
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(p.user_id);
    if (!u || u.disabled || u.locked_until > Date.now())
      return res.status(401).json({ error: "Account unavailable." });
    const v = await verifyAuthenticationResponse({
      response: req.body.response,
      expectedChallenge: c.value,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: {
        id: p.id,
        publicKey: Buffer.from(p.public_key, "base64url"),
        counter: p.counter,
        transports: JSON.parse(p.transports),
      },
    });
    if (!v.verified)
      return res.status(401).json({ error: "Passkey verification failed." });
    const currentUser = db.prepare("SELECT * FROM users WHERE id=?").get(u.id);
    const currentPasskey = db
      .prepare("SELECT * FROM passkeys WHERE id=? AND user_id=?")
      .get(p.id, u.id);
    if (
      !currentUser ||
      currentUser.disabled ||
      currentUser.locked_until > Date.now() ||
      currentUser.password !== u.password ||
      !currentPasskey ||
      currentPasskey.counter !== p.counter
    )
      return res
        .status(401)
        .json({ error: "Account or passkey changed. Try again." });
    db.prepare("UPDATE passkeys SET counter=? WHERE id=?").run(
      v.authenticationInfo.newCounter,
      p.id,
    );
    req.user = u;
    audit(req, "PASSKEY_LOGIN");
    res.json(session(req, res, u));
  });
  app.get("/api/auth/passkeys", auth, (req, res) =>
    res.json({
      passkeys: db
        .prepare("SELECT id FROM passkeys WHERE user_id=?")
        .all(req.user.id),
    }),
  );
  app.delete("/api/auth/passkeys/:id", auth, recent, (req, res) => {
    db.prepare("DELETE FROM passkeys WHERE id=? AND user_id=?").run(
      req.params.id,
      req.user.id,
    );
    audit(req, "PASSKEY_REMOVED");
    res.json({ ok: true });
  });

  const serialize = (e, userId) => ({
    id: e.id,
    owner_id: userId,
    name: e.name,
    address: e.address,
    category: e.category,
    icon: e.icon,
    description: e.description,
    method: e.method,
    position: e.position,
    hasCredentials: !!e.vault,
    isFavorite: !!db
      .prepare("SELECT 1 FROM favorites WHERE user_id=? AND entry_id=?")
      .get(userId, e.id),
  });
  app.get("/api/entries", auth, (req, res) =>
    res.json({
      entries: db
        .prepare("SELECT * FROM entries WHERE owner_id=? ORDER BY position,id")
        .all(req.user.id)
        .map((e) => serialize(e, req.user.id)),
    }),
  );
  app.get("/api/entries/:id", auth, (req, res) => {
    const e = own(req, res);
    if (e) res.json(serialize(e, req.user.id));
  });
  function insertEntry(userId, b, key) {
    const id = Number(
      db
        .prepare(
          "INSERT INTO entries(owner_id,name,address,category,icon,description,method,access,position,vault_version) VALUES (?,?,?,?,?,?,?,'[]',?,2)",
        )
        .run(
          userId,
          b.name,
          b.address,
          b.category,
          b.icon,
          b.description,
          b.method,
          Date.now(),
        ).lastInsertRowid,
    );
    if (b.credentials)
      db.prepare("UPDATE entries SET vault=? WHERE id=? AND owner_id=?").run(
        key.encrypt(b.credentials, `user:${userId}:entry:${id}`),
        id,
        userId,
      );
    return id;
  }
  app.post("/api/entries", auth, editor, (req, res) => {
    const b = entrySchema.parse(req.body),
      key = keys.get(req.session.id);
    if (b.credentials && !key)
      return res.status(403).json({
        error:
          "Unlock your vault with your account password in Security first.",
        requireReauth: true,
      });
    const id = transaction(db, () => insertEntry(req.user.id, b, key));
    audit(req, "ENTRY_CREATED", id);
    res.status(201).json({ id });
  });
  app.put("/api/entries/:id", auth, editor, (req, res) => {
    const e = own(req, res);
    if (!e) return;
    const b = entrySchema.parse(req.body),
      key = keys.get(req.session.id);
    if (b.credentials && !key)
      return res.status(403).json({
        error: "Unlock your vault in Security first.",
        requireReauth: true,
      });
    let encrypted = e.vault;
    if (b.clearCredentials) encrypted = null;
    else if (b.credentials)
      encrypted = key.encrypt(
        b.credentials,
        `user:${req.user.id}:entry:${e.id}`,
      );
    db.prepare(
      "UPDATE entries SET name=?,address=?,category=?,icon=?,description=?,method=?,vault=?,vault_version=2 WHERE id=? AND owner_id=?",
    ).run(
      b.name,
      b.address,
      b.category,
      b.icon,
      b.description,
      b.method,
      encrypted,
      e.id,
      req.user.id,
    );
    audit(req, "ENTRY_UPDATED", e.id);
    res.json({ ok: true });
  });
  app.delete("/api/entries/:id", auth, editor, (req, res) => {
    const e = own(req, res);
    if (!e) return;
    db.prepare("DELETE FROM entries WHERE id=? AND owner_id=?").run(
      e.id,
      req.user.id,
    );
    audit(req, "ENTRY_DELETED", e.id);
    res.json({ ok: true });
  });
  app.post("/api/entries/reorder", auth, editor, (req, res) => {
    const ids = z
      .array(z.number().int().positive())
      .max(2000)
      .parse(req.body.order);
    if (
      new Set(ids).size !== ids.length ||
      ids.some(
        (id) =>
          !db
            .prepare("SELECT 1 FROM entries WHERE id=? AND owner_id=?")
            .get(id, req.user.id),
      )
    )
      return res.status(404).json({ error: "Entry not found." });
    transaction(db, () =>
      ids.forEach((id, i) =>
        db
          .prepare("UPDATE entries SET position=? WHERE id=? AND owner_id=?")
          .run(i, id, req.user.id),
      ),
    );
    audit(req, "ENTRIES_REORDERED");
    res.json({ ok: true });
  });
  app.post("/api/favorites/:id", auth, (req, res) => {
    const e = own(req, res);
    if (!e) return;
    const exists = db
      .prepare("SELECT 1 FROM favorites WHERE user_id=? AND entry_id=?")
      .get(req.user.id, e.id);
    if (exists)
      db.prepare("DELETE FROM favorites WHERE user_id=? AND entry_id=?").run(
        req.user.id,
        e.id,
      );
    else
      db.prepare("INSERT INTO favorites VALUES (?,?)").run(req.user.id, e.id);
    res.json({ favorited: !exists });
  });
  app.post("/api/entries/:id/reveal", auth, authLimit, async (req, res) => {
    const e = own(req, res);
    if (!e) return;
    const key = await confirmPassword(req, res, req.body.password);
    if (!key) return;
    const current = db
      .prepare("SELECT vault FROM entries WHERE id=? AND owner_id=?")
      .get(e.id, req.user.id);
    audit(req, "CREDENTIAL_REVEALED", e.id);
    res.json(
      current?.vault
        ? key.decrypt(current.vault, `user:${req.user.id}:entry:${e.id}`)
        : { username: "", password: "" },
    );
  });
  app.get("/api/entries/:id/rdp", auth, (req, res) => {
    const e = own(req, res);
    if (!e) return;
    if (e.method !== "rdp")
      return res
        .status(400)
        .json({ error: "This entry is not an RDP target." });
    let credentials = {};
    const key = keys.get(req.session.id);
    if (e.vault && key) {
      credentials = key.decrypt(e.vault, `user:${req.user.id}:entry:${e.id}`);
      audit(req, "RDP_USERNAME_ACCESS", e.id);
    }
    audit(req, "RDP_DOWNLOAD", e.id);
    res
      .type("application/x-rdp")
      .attachment(`${e.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.rdp`)
      .send(
        Buffer.from("\ufeff" + generateRdpContent(e, credentials), "utf16le"),
      );
  });
  app.get("/api/entries/:id/ssh-launch", auth, (req, res) => {
    const e = own(req, res);
    if (!e) return;
    if (e.method !== "ssh")
      return res.status(400).json({ error: "Not an SSH target." });
    const platform = z
        .enum(["windows", "mac", "linux"])
        .parse(req.query.platform),
      file = sshLaunchFile(e.address, platform);
    audit(req, "SSH_LAUNCH_DOWNLOAD", e.id);
    res
      .type("application/octet-stream")
      .attachment(`${e.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.${file.extension}`)
      .send(file.content);
  });
  app.post(
    "/api/entries/:id/ssh-connect",
    auth,
    authLimit,
    async (req, res) => {
      const e = own(req, res);
      if (!e) return;
      if (e.method !== "ssh")
        return res.status(400).json({ error: "Not an SSH target." });
      const key = await confirmPassword(req, res, req.body.password);
      if (!key) return;
      const credentials = e.vault
        ? key.decrypt(e.vault, `user:${req.user.id}:entry:${e.id}`)
        : {};
      const ticket = await issueSshTicket(
        e.address,
        credentials,
        req.session.id,
      );
      audit(req, "SSH_CREDENTIAL_ACCESS", e.id);
      res.json({ token: ticket });
    },
  );
  app.post("/api/ping", auth, probeLimit, async (req, res) => {
    const e = db
      .prepare("SELECT * FROM entries WHERE id=? AND owner_id=?")
      .get(Number(req.body.id) || 0, req.user.id);
    if (!e) return res.status(404).json({ error: "Entry not found." });
    res.json(await pingEntry(e.address, e.method));
  });
  app.get("/api/icons", auth, (_req, res) =>
    res.json({
      icons: JSON.parse(fs.readFileSync("server/icons.json", "utf8")),
    }),
  );
  app.post("/api/icons/favicon", auth, async (req, res) => {
    const url = z.string().url().max(2048).parse(req.body.url);
    const icon = await fetchFavicon(url);
    if (!icon)
      return res.status(400).json({
        error: "No safe PNG favicon found. Upload a PNG/SVG instead.",
      });
    res.json({ icon });
  });
  app.get("/api/settings", auth, (req, res) =>
    res.json(
      JSON.parse(
        db
          .prepare("SELECT value FROM settings WHERE owner_id=?")
          .get(req.user.id)?.value || "{}",
      ),
    ),
  );
  app.put("/api/settings", auth, (req, res) => {
    const b = z
      .object({
        theme: z.enum(["dark", "light"]).optional(),
        accent: z
          .enum(["cyan", "emerald", "cyberpunk", "amber", "sapphire"])
          .optional(),
        sidebarCollapsed: z.boolean().optional(),
        cardView: z.enum(["compact", "expanded"]).optional(),
        cardLayout: z.enum(["grid", "comfortable", "list"]).optional(),
      })
      .parse(req.body);
    const old = JSON.parse(
        db
          .prepare("SELECT value FROM settings WHERE owner_id=?")
          .get(req.user.id)?.value || "{}",
      ),
      value = { ...old, ...b };
    db.prepare(
      "INSERT INTO settings VALUES (?,?) ON CONFLICT(owner_id) DO UPDATE SET value=excluded.value",
    ).run(req.user.id, JSON.stringify(value));
    res.json(value);
  });
  const userInput = z.object({
    username: z.string().regex(/^[a-zA-Z0-9_.-]{3,64}$/),
    password: passwordSchema,
    role: z.enum(["Admin", "Editor", "Viewer"]),
  });
  app.get("/api/users", auth, admin, (_req, res) =>
    res.json({
      users: db
        .prepare(
          "SELECT id,username,role,disabled,must_change,created_at,totp IS NOT NULL AS has_totp FROM users ORDER BY id",
        )
        .all(),
    }),
  );
  app.post("/api/users", auth, admin, recent, async (req, res) => {
    const b = userInput.parse(req.body);
    if (
      db
        .prepare("SELECT 1 FROM users WHERE username=? COLLATE NOCASE")
        .get(b.username)
    )
      return res.status(409).json({ error: "Username already exists." });
    const h = await hashPassword(b.password);
    if (!stillAuthorized(req, res, true)) return;
    const id = Number(
      db
        .prepare(
          "INSERT INTO users(username,password,role,vault_salt) VALUES (?,?,?,?)",
        )
        .run(b.username, h, b.role, token()).lastInsertRowid,
    );
    audit(req, "USER_CREATED", id);
    res.status(201).json({ id });
  });
  app.put("/api/users/:id", auth, admin, recent, async (req, res) => {
    if (
      Object.hasOwn(req.body, "password") ||
      Object.hasOwn(req.body, "confirmVaultLoss")
    )
      return res.status(403).json({
        error:
          "Administrators cannot reset another user's password or access their private workspace.",
      });
    const b = z
        .object({
          role: z.enum(["Admin", "Editor", "Viewer"]).optional(),
          disabled: z.boolean().optional(),
        })
        .parse(req.body),
      id = Number(req.params.id) || 0;
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
    if (!u) return res.status(404).json({ error: "User not found." });
    if (id === req.user.id && (b.disabled || (b.role && b.role !== "Admin")))
      return res.status(400).json({
        error:
          "Use Change password for your account; you cannot disable or demote yourself.",
      });
    transaction(db, () => {
      db.prepare("UPDATE users SET role=?,disabled=? WHERE id=?").run(
        b.role || u.role,
        b.disabled === undefined ? u.disabled : Number(b.disabled),
        id,
      );
      revoke(id);
    });
    audit(req, "USER_UPDATED", id);
    res.json({ ok: true });
  });
  app.delete("/api/users/:id", auth, admin, recent, (req, res) => {
    const id = Number(req.params.id) || 0;
    if (id === req.user.id)
      return res.status(400).json({ error: "Cannot delete your own account." });
    revoke(id);
    const result = db.prepare("DELETE FROM users WHERE id=?").run(id);
    if (!result.changes)
      return res.status(404).json({ error: "User not found." });
    audit(req, "USER_DELETED", id);
    res.json({ ok: true });
  });
  app.get("/api/audit", auth, (req, res) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(1000000)
      .default(1)
      .parse(req.query.page);
    res.json({
      logs: db
        .prepare(
          "SELECT id,at,actor,action,target,ip FROM audit WHERE actor_id=? ORDER BY id DESC LIMIT 50 OFFSET ?",
        )
        .all(req.user.id, (page - 1) * 50),
      total: db
        .prepare("SELECT count(*) AS n FROM audit WHERE actor_id=?")
        .get(req.user.id).n,
      page,
      limit: 50,
    });
  });
  app.get("/api/backup/export", auth, (req, res) => {
    const entries = db
      .prepare(
        "SELECT name,address,category,icon,description,method,position FROM entries WHERE owner_id=? ORDER BY position,id",
      )
      .all(req.user.id);
    audit(req, "SHORTCUTS_EXPORTED");
    res.attachment("zaddesh-shortcuts.json").json({ version: 2, entries });
  });
  app.post("/api/vault/export", auth, authLimit, async (req, res) => {
    const archivePassword = passwordSchema.parse(req.body.archivePassword);
    const key = await confirmPassword(req, res, req.body.password);
    if (!key) return;
    const entries = db
      .prepare("SELECT * FROM entries WHERE owner_id=? ORDER BY position,id")
      .all(req.user.id)
      .map((e) => ({
        name: e.name,
        address: e.address,
        category: e.category,
        icon: e.icon,
        description: e.description,
        method: e.method,
        ...(e.vault
          ? {
              credentials: key.decrypt(
                e.vault,
                `user:${req.user.id}:entry:${e.id}`,
              ),
            }
          : {}),
      }));
    const salt = token();
    const archive = {
      format: "zaddesh-vault",
      version: 1,
      salt,
      payload: createVault(archivePassword, salt).encrypt(
        { entries },
        "zaddesh-user-export:v1",
      ),
    };
    audit(req, "PERSONAL_VAULT_EXPORTED", entries.length);
    res.json(archive);
  });
  app.post("/api/vault/import", auth, editor, authLimit, async (req, res) => {
    const archive = z
      .object({
        format: z.literal("zaddesh-vault"),
        version: z.literal(1),
        salt: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        payload: z.string().max(3900000),
      })
      .parse(req.body.archive);
    const archivePassword = passwordSchema.parse(req.body.archivePassword);
    const key = await confirmPassword(req, res, req.body.password);
    if (!key) return;
    let decoded;
    try {
      decoded = createVault(archivePassword, archive.salt).decrypt(
        archive.payload,
        "zaddesh-user-export:v1",
      );
    } catch {
      return res
        .status(400)
        .json({ error: "Wrong archive password or damaged vault file." });
    }
    const entries = z.array(entrySchema).max(1000).parse(decoded.entries);
    transaction(db, () =>
      entries.forEach((entry) => insertEntry(req.user.id, entry, key)),
    );
    audit(req, "PERSONAL_VAULT_IMPORTED", entries.length);
    res.json({ imported: entries.length });
  });
  app.post("/api/backup/import", auth, editor, (req, res) => {
    const input = z.array(entrySchema).max(1000).parse(req.body.entries);
    if (input.some((e) => e.credentials))
      return res.status(400).json({
        error:
          "Import shortcut definitions only. Add secrets through the vault form.",
      });
    transaction(db, () =>
      input.forEach((b) => insertEntry(req.user.id, b, null)),
    );
    audit(req, "SHORTCUTS_IMPORTED", input.length);
    res.json({ ok: true, imported: input.length });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError)
      return res.status(400).json({ error: err.issues[0].message });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Request too large." });
    if (err instanceof SyntaxError)
      return res.status(400).json({ error: "Invalid JSON." });
    console.error("Request failed:", err.name);
    res.status(400).json({
      error: "Unable to complete request. Check the input and try again.",
    });
  });
  const cleanup = setInterval(() => {
    for (const row of db
      .prepare("SELECT id FROM sessions WHERE touched<? OR created<?")
      .all(Date.now() - config.idleMs, Date.now() - config.maxMs)) {
      keys.delete(row.id);
      db.prepare("DELETE FROM sessions WHERE id=?").run(row.id);
    }
    db.prepare("DELETE FROM challenges WHERE expires<?").run(Date.now());
  }, 60000);
  cleanup.unref();
  return {
    app,
    db,
    close() {
      clearInterval(cleanup);
      keys.clear();
      db.close();
    },
  };
}
