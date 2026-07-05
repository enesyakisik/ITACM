/**
 * Central configuration — everything comes from environment variables.
 *
 * DATA_BACKEND selects the storage/auth provider:
 *   "postgres" — self-hosted: PostgreSQL + local JWT auth (docker compose up)
 *   "firebase" — managed: Firebase Auth + Firestore (bring your own project)
 */
require('dotenv').config();

const VALID_BACKENDS = ['postgres', 'firebase'];

const backend = (process.env.DATA_BACKEND || 'postgres').toLowerCase();
if (!VALID_BACKENDS.includes(backend)) {
  throw new Error(
    `Invalid DATA_BACKEND="${process.env.DATA_BACKEND}". Use one of: ${VALID_BACKENDS.join(', ')}`
  );
}

const config = {
  backend,
  port: Number(process.env.PORT) || 8000,
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

  // --- postgres mode -------------------------------------------------------
  databaseUrl: process.env.DATABASE_URL || '',
  pgSsl: process.env.PGSSL === 'true' || process.env.PGSSL === 'require',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  // First-run admin seed (postgres mode only)
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminUsername: process.env.ADMIN_USERNAME || 'IT Admin',
  adminPassword: process.env.ADMIN_PASSWORD || '', // generated & logged if empty

  // --- firebase mode -------------------------------------------------------
  // Preferred on PaaS (Vercel etc.): base64 of the service account JSON.
  firebaseServiceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
  // Alternative: raw JSON string in one env var.
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  // Local dev alternative: GOOGLE_APPLICATION_CREDENTIALS file path (ADC).

  // Firebase *web app* config JSON (public, no secrets) — lets the built-in
  // UI sign in with the Firebase Web SDK in firebase mode.
  firebaseWebConfig: process.env.FIREBASE_WEB_CONFIG || '',
};

function assertBackendConfig() {
  if (config.backend === 'postgres') {
    if (!config.databaseUrl) {
      throw new Error(
        'DATA_BACKEND=postgres requires DATABASE_URL (e.g. postgres://user:pass@localhost:5432/itacm)'
      );
    }
    if (!config.jwtSecret || config.jwtSecret.length < 32) {
      throw new Error(
        'DATA_BACKEND=postgres requires JWT_SECRET (min 32 chars). Generate one: openssl rand -hex 32'
      );
    }
  }
}

module.exports = { ...config, assertBackendConfig };
