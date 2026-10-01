import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { token, createVault, hashPassword } from "./security.js";
import { encryptedSnapshot } from "./backup.js";

export async function openDatabase(config) {
  fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(config.dataDir, "zaddesh.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Admin','Editor','Viewer')), disabled INTEGER NOT NULL DEFAULT 0, must_change INTEGER NOT NULL DEFAULT 1, failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, totp TEXT, totp_last INTEGER NOT NULL DEFAULT -1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, created INTEGER NOT NULL, touched INTEGER NOT NULL, reauth INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, address TEXT NOT NULL, category TEXT NOT NULL, icon TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', method TEXT NOT NULL DEFAULT 'web', access TEXT NOT NULL DEFAULT '[]', vault TEXT, position INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE, PRIMARY KEY(user_id,entry_id));
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, ip TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS passkeys(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, public_key TEXT NOT NULL, counter INTEGER NOT NULL, transports TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, value TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, value TEXT NOT NULL);
  `);
  const cols = (table) =>
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((c) => c.name);
  // Legacy events have no trustworthy immutable owner; never infer ownership from reusable usernames.
  if (!cols("audit").includes("actor_id"))
    db.exec(
      "ALTER TABLE audit ADD COLUMN actor_id INTEGER; CREATE INDEX audit_actor ON audit(actor_id,id);",
    );
  if (!cols("entries").includes("owner_id"))
    throw Error("Legacy entries have no owners. See MIGRATION.md.");
  if (!cols("users").includes("vault_salt")) {
    encryptedSnapshot(
      db,
      path.join(config.dataDir, `pre-v2-${Date.now()}.zdb`),
      config.vaultSecret,
    );
    db.exec(
      "ALTER TABLE users ADD COLUMN vault_salt TEXT; ALTER TABLE entries ADD COLUMN vault_version INTEGER NOT NULL DEFAULT 1; DELETE FROM sessions; DELETE FROM challenges;",
    );
  }
  db.exec(
    "CREATE INDEX IF NOT EXISTS entries_owner ON entries(owner_id,position);",
  );
  let salt = db
    .prepare("SELECT value FROM meta WHERE key='vault_salt'")
    .get()?.value;
  if (!salt) {
    salt = token();
    db.prepare("INSERT INTO meta VALUES (?,?)").run("vault_salt", salt);
  }
  const vault = createVault(config.vaultSecret, salt);
  const check = db
    .prepare("SELECT value FROM meta WHERE key='vault_check'")
    .get()?.value;
  if (check) {
    if (vault.decrypt(check, "check") !== "ZadDesh")
      throw Error("Incorrect VAULT_SECRET.");
  } else
    db.prepare("INSERT INTO meta VALUES (?,?)").run(
      "vault_check",
      vault.encrypt("ZadDesh", "check"),
    );
  if (!db.prepare("SELECT id FROM users LIMIT 1").get()) {
    const password = config.initialPassword || `Zd!${token()}`;
    db.prepare(
      "INSERT INTO users(username,password,role,vault_salt) VALUES (?,?,'Admin',?)",
    ).run("admin", await hashPassword(password), token());
    if (!config.initialPassword)
      console.log(`FIRST RUN — admin temporary password: ${password}`);
  }
  return { db, vault };
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function unlockVault(db, serverVault, user, password) {
  const salt = user.vault_salt || token(),
    key = createVault(password, salt);
  transaction(db, () => {
    for (const e of db
      .prepare(
        "SELECT id,vault FROM entries WHERE owner_id=? AND vault_version=1 AND vault IS NOT NULL",
      )
      .all(user.id)) {
      const credentials = serverVault.decrypt(e.vault, `entry:${e.id}`);
      db.prepare(
        "UPDATE entries SET vault=?,vault_version=2 WHERE id=? AND owner_id=?",
      ).run(
        key.encrypt(credentials, `user:${user.id}:entry:${e.id}`),
        e.id,
        user.id,
      );
    }
    db.prepare("UPDATE users SET vault_salt=? WHERE id=?").run(salt, user.id);
  });
  return key;
}
