import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { configuration } from "../server/config.js";
import { encryptedSnapshot } from "../server/backup.js";
import { transaction } from "../server/db.js";
const config = configuration(),
  db = new DatabaseSync(path.join(config.dataDir, "zaddesh.sqlite"));
try {
  if (
    db
      .prepare("PRAGMA table_info(entries)")
      .all()
      .some((c) => c.name === "owner_id")
  )
    throw Error("Ownership column already exists; migration not needed.");
  const file = process.argv[2];
  if (!file)
    throw Error(
      "Provide a JSON object mapping every entry ID to its owner user ID. Stop the app first.",
    );
  const map = JSON.parse(fs.readFileSync(file, "utf8")),
    entries = db.prepare("SELECT id FROM entries").all();
  if (
    entries.some(
      (e) =>
        !Number.isInteger(map[e.id]) ||
        !db.prepare("SELECT 1 FROM users WHERE id=?").get(map[e.id]),
    )
  )
    throw Error("Every entry needs an explicit valid owner.");
  encryptedSnapshot(
    db,
    path.join(config.dataDir, `pre-ownership-${Date.now()}.zdb`),
    config.vaultSecret,
  );
  transaction(db, () => {
    db.exec(
      "ALTER TABLE entries ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;",
    );
    for (const e of entries)
      db.prepare("UPDATE entries SET owner_id=? WHERE id=?").run(
        map[e.id],
        e.id,
      );
    db.exec(
      "CREATE TRIGGER require_entry_owner_insert BEFORE INSERT ON entries WHEN NEW.owner_id IS NULL BEGIN SELECT RAISE(ABORT,'owner required'); END; CREATE TRIGGER require_entry_owner_update BEFORE UPDATE OF owner_id ON entries WHEN NEW.owner_id IS NULL BEGIN SELECT RAISE(ABORT,'owner required'); END; DELETE FROM sessions; DELETE FROM challenges;",
    );
  });
  console.log(
    `Migrated ${entries.length} entries. Original database preserved in an encrypted snapshot (password: existing VAULT_SECRET).`,
  );
} finally {
  db.close();
}
