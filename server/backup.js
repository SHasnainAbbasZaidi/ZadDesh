import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createVault, token } from "./security.js";

export function encryptedSnapshot(db, destination, password) {
  if (!password || password.length < 16)
    throw Error("BACKUP_PASSWORD must be at least 16 characters.");
  const temp = path.join(
    path.dirname(destination),
    `.snapshot-${crypto.randomUUID()}.sqlite`,
  );
  try {
    db.prepare("VACUUM INTO ?").run(temp);
    const salt = token(),
      vault = createVault(password, salt);
    const payload = {
      format: "zaddesh-backup-v2",
      salt,
      payload: vault.encrypt(
        fs.readFileSync(temp).toString("base64"),
        "zaddesh-full-backup",
      ),
    };
    fs.writeFileSync(destination, JSON.stringify(payload), {
      flag: "wx",
      mode: 0o600,
    });
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

export function restoreSnapshot(source, destination, password) {
  if (!password || password.length < 16)
    throw Error("BACKUP_PASSWORD must be at least 16 characters.");
  if (
    fs.existsSync(destination) ||
    fs.existsSync(destination + "-wal") ||
    fs.existsSync(destination + "-shm")
  )
    throw Error(
      "Restore requires a new, empty DATA_DIR. Existing databases are never overwritten.",
    );
  const input = JSON.parse(fs.readFileSync(source, "utf8"));
  if (
    input.format !== "zaddesh-backup-v2" ||
    typeof input.salt !== "string" ||
    input.salt.length > 100
  )
    throw Error("Unsupported backup format.");
  const buffer = Buffer.from(
    createVault(password, input.salt).decrypt(
      input.payload,
      "zaddesh-full-backup",
    ),
    "base64",
  );
  if (buffer.subarray(0, 16).toString() !== "SQLite format 3\0")
    throw Error("Invalid SQLite backup.");
  const temp = destination + ".restore-" + crypto.randomUUID();
  let db;
  try {
    fs.writeFileSync(temp, buffer, { flag: "wx", mode: 0o600 });
    db = new DatabaseSync(temp);
    if (
      db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").all().length
    )
      throw Error("Backup integrity check failed.");
    db.exec(
      "DELETE FROM sessions; DELETE FROM challenges; PRAGMA journal_mode=DELETE;",
    );
    db.close();
    db = null;
    fs.renameSync(temp, destination);
  } finally {
    if (db) db.close();
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
