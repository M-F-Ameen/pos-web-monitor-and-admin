import crypto from "node:crypto";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  const fallback = crypto.randomBytes(32).toString("hex");
  console.warn(
    "[config] WARNING: JWT_SECRET not set or too short. " +
    "Generated a random fallback — all sessions will be invalidated on restart. " +
    "Set a strong JWT_SECRET env var (min 32 chars) in production."
  );
  return fallback;
}

export const JWT_SECRET = getJwtSecret();
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
