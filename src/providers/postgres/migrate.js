/**
 * Automatic database provisioning for postgres mode.
 *
 * Runs on every server start:
 *   1. Applies schema.sql — fully idempotent (CREATE ... IF NOT EXISTS).
 *   2. Seeds the first Owner user if the users table is empty.
 *      Password comes from ADMIN_PASSWORD; if unset, a strong random one is
 *      generated and printed ONCE to the server log.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool, query } = require('./pool');
const config = require('../../config');

let ensured = null;

async function ensureDatabase() {
  if (!ensured) ensured = provision();
  return ensured;
}

async function provision() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await seedAdmin();
  console.log('[itacm] PostgreSQL schema ready');
}

async function seedAdmin() {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return;

  const password = config.adminPassword || crypto.randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(password, 12);

  await query(
    `INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'Owner')`,
    [config.adminUsername, config.adminEmail.toLowerCase(), hash]
  );

  console.log('='.repeat(64));
  console.log('[itacm] First-run setup: Owner account created');
  console.log(`[itacm]   email:    ${config.adminEmail.toLowerCase()}`);
  if (config.adminPassword) {
    console.log('[itacm]   password: (from ADMIN_PASSWORD env var)');
  } else {
    console.log(`[itacm]   password: ${password}`);
    console.log('[itacm]   ^ generated randomly — CHANGE IT after first login!');
  }
  console.log('='.repeat(64));
}

// Allow running standalone: `npm run migrate`
if (require.main === module) {
  ensureDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[itacm] migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { ensureDatabase };
