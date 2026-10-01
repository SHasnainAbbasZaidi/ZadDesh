import fs from "node:fs";
import path from "node:path";
import { restoreSnapshot } from "../server/backup.js";
if (!process.argv[2])
  throw Error("Usage: npm run restore -- path/to/backup.zdb");
const directory = path.resolve(process.env.DATA_DIR || "data");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
restoreSnapshot(
  path.resolve(process.argv[2]),
  path.join(directory, "zaddesh.sqlite"),
  process.env.BACKUP_PASSWORD,
);
console.log(
  `Restored to ${directory}. Use the original VAULT_SECRET and user passwords.`,
);
