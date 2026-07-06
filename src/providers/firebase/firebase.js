/**
 * Firebase Admin bootstrap.
 *
 * Credential resolution order (never commit the key file!):
 *  1. FIREBASE_SERVICE_ACCOUNT_BASE64 — base64-encoded service account JSON
 *     (recommended for Vercel/PaaS secret stores)
 *  2. FIREBASE_SERVICE_ACCOUNT_JSON   — raw JSON string
 *  3. GOOGLE_APPLICATION_CREDENTIALS  — file path (local dev)
 *  4. FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS=true — Google Cloud ADC
 */
const admin = require('firebase-admin');
const config = require('../../config');

function parseServiceAccountJson(raw, source) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${source} must contain valid Firebase service account JSON: ${err.message}`);
  }
}

function resolveCredential() {
  if (config.firebaseServiceAccountBase64) {
    const decoded = Buffer.from(config.firebaseServiceAccountBase64, 'base64').toString('utf8');
    return admin.credential.cert(
      parseServiceAccountJson(decoded, 'FIREBASE_SERVICE_ACCOUNT_BASE64')
    );
  }
  if (config.firebaseServiceAccountJson) {
    return admin.credential.cert(
      parseServiceAccountJson(config.firebaseServiceAccountJson, 'FIREBASE_SERVICE_ACCOUNT_JSON')
    );
  }
  return undefined; // fall back to GOOGLE_APPLICATION_CREDENTIALS / explicit ADC
}

// Initialize defensively: a malformed credential must NOT crash module load
// (that would take down every route, including /api/config, and make the UI
// silently fall back to the postgres default). Instead we record the error
// and surface it as a clear message on the first API call.
let initError = null;
if (!admin.apps.length) {
  try {
    const credential = resolveCredential();
    admin.initializeApp(credential ? { credential } : undefined);
  } catch (err) {
    initError = err.message || String(err);
    console.error('[firebase] initialization failed:', initError);
    try { admin.initializeApp(); } catch { /* leave uninitialized */ }
  }
}

const db = admin.firestore();
try { db.settings({ ignoreUndefinedProperties: true }); } catch { /* already set */ }

const auth = admin.auth();
const { FieldValue, Timestamp } = admin.firestore;

const COLLECTIONS = {
  USERS: 'users',
  EMPLOYEES: 'employees',
  ASSETS: 'assets',
  LICENSES: 'licenses',
  CONSUMABLES: 'consumables',
  HANDOVERS: 'handovers',
  MAINTENANCE_LOGS: 'maintenanceLogs',
  ASSET_HISTORY: 'assetHistory',
};

const ROLES = Object.freeze(['Owner', 'Admin', 'Helpdesk', 'Viewer']);

const ASSET_STATUS = Object.freeze({
  IN_STOCK: 'In Stock',
  ASSIGNED: 'Assigned',
  IN_REPAIR: 'In Repair',
  SCRAP: 'Scrap',
});

module.exports = { admin, db, auth, FieldValue, Timestamp, COLLECTIONS, ROLES, ASSET_STATUS, initError };
