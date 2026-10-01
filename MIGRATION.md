# Migration and recovery

Stop the old application and preserve the original `.env` / `VAULT_SECRET`. Do not run old and new versions against the same SQLite file.

## Missing ownership

The old runtime expected `entries.owner_id`, but the original database in this workspace did not contain it. Do not infer owners from entry names, role, favorites, or account order. Obtain explicit ownership instructions.

Create a JSON object mapping **every** entry ID to a valid user ID, then:

```sh
npm run migrate -- path/to/owner-map.json
```

The script refuses an incomplete/invalid mapping, creates a consistent encrypted snapshot before changes, adds `owner_id`, applies the mapping transactionally, requires owners for subsequent writes, and invalidates sessions/challenges. The script does not silently copy entries to all users or assume Admin owns unknown data.

For this workspace the user explicitly chose **all 12 existing entries → admin (user ID 1)**. The applied map is `data/owner-map.json`. The original database was preserved as `data/pre-ownership-<timestamp>.zdb`, encrypted with the existing `VAULT_SECRET` as the backup password. `hasnain.zaidi` receives no copied entries.

## Schema upgrade and vault conversion

On startup, v2 adds `users.vault_salt` and `entries.vault_version` after an encrypted pre-v2 snapshot. Existing encrypted credentials are marked version 1. A version-1 record is converted **only during its owner's successful password verification**:

1. Verify the Argon2id password and required MFA.
2. Generate the user's random salt if absent and derive their scrypt key from their own password.
3. Decrypt only their version-1 credentials with the original server vault key and the original `entry:<id>` context.
4. Re-encrypt with the password-derived key and `user:<owner_id>:entry:<id>` context, with a new random nonce per record.
5. Commit that user's conversion as a single transaction. If decryption fails, roll back without destroying the old ciphertext.

No batch migration can create password-derived keys without the users' passwords. Keep the original server key until every legacy vault and TOTP secret has migrated. A passkey login alone does not provide a vault key; password confirmation performs the conversion/unlock.

New resources use version 2. Password changes re-encrypt all owned credentials atomically. Admin password resets are disabled to prevent impersonation. Existing credentials and accounts remain untouched. The activity-log migration adds a nullable immutable actor ID; existing records remain in storage but are not exposed through the app because their ownership cannot be safely inferred from reusable usernames.

## Recovery / rollback

Use `BACKUP_PASSWORD` equal to the original `VAULT_SECRET` to restore a migration snapshot into a **new empty directory** with `npm run restore -- path/to/snapshot.zdb`. Never overwrite the live database or manually copy its main file while WAL writes are active. Restore verifies integrity and removes stale sessions. Keep the original source version if you need to roll back the application too.

A pre-migration snapshot can contain records without ownership. Re-running v2 against that snapshot requires the explicit ownership map again. Full v2 backups preserve owner IDs, salts and password-derived ciphertext. Users need the passwords from the time of the backup.

After checking the new application, ownership, credential reveals, and recovery, secure or retire old snapshots according to your retention policy. Old snapshots may still use the legacy server-wide encryption scheme.
