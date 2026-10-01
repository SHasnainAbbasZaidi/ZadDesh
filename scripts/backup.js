import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { encryptedSnapshot } from "../server/backup.js";
const directory = path.resolve(process.env.DATA_DIR || "data"),
  source = path.join(directory, "zaddesh.sqlite");
if (!fs.existsSync(source)) throw Error("Database does not exist.");
fs.mkdirSync("backups", { recursive: true, mode: 0o700 });
const destination = path.resolve("backups", `zaddesh-${Date.now()}.zdb`),
  db = new DatabaseSync(source);
try {
  encryptedSnapshot(db, destination, process.env.BACKUP_PASSWORD);
  console.log(`Encrypted backup: ${destination}`);
} finally {
  db.close();
}
