import path from "node:path";
export function configuration(env = process.env) {
  const port = Number(env.PORT || 8443),
    origin = new URL(env.APP_ORIGIN || `http://localhost:${port}`);
  if (!env.VAULT_SECRET || env.VAULT_SECRET.length < 32)
    throw Error(
      "Set a persistent random VAULT_SECRET of at least 32 characters.",
    );
  if (
    env.NODE_ENV === "production" &&
    (env.FORCE_HTTPS !== "true" || origin.protocol !== "https:")
  )
    throw Error(
      "Production requires FORCE_HTTPS=true and an HTTPS APP_ORIGIN.",
    );
  if (env.FORCE_HTTPS === "true" && origin.protocol !== "https:")
    throw Error("FORCE_HTTPS requires HTTPS APP_ORIGIN.");
  const idleMs = Number(env.SESSION_IDLE_MINUTES || 20) * 60000,
    maxMs = Number(env.SESSION_MAX_HOURS || 12) * 3600000;
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isFinite(idleMs) ||
    idleMs < 60000 ||
    !Number.isFinite(maxMs) ||
    maxMs < 60000
  )
    throw Error("Invalid port or session duration.");
  return {
    port,
    host: env.HOST || "127.0.0.1",
    origin: origin.origin,
    rpID: origin.hostname,
    secure: origin.protocol === "https:",
    forceHttps: env.FORCE_HTTPS === "true",
    trustProxy: Number(env.TRUST_PROXY || 0),
    dataDir: path.resolve(env.DATA_DIR || "data"),
    vaultSecret: env.VAULT_SECRET,
    initialPassword: env.INITIAL_ADMIN_PASSWORD,
    idleMs,
    maxMs,
  };
}
