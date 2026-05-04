function envString(name, fallback) {
  const v = process.env[name];
  return v !== undefined && String(v).trim() !== "" ? String(v).trim() : fallback;
}

/** Single place for env defaults (override via `.env` or process env). */
export const config = {
  port: Number(envString("PORT", "5000")) || 5000,
  publicHost: envString("PUBLIC_HOST", "192.168.1.3"),
  mongoUri: envString("MONGODB_URI", "mongodb://127.0.0.1:27017/simple_app"),
  jwtSecret: envString("JWT_SECRET", "dev-only-change-in-production"),
};
