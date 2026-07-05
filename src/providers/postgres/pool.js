const { Pool } = require('pg');
const config = require('../../config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.pgSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

const query = (text, params) => pool.query(text, params);

/** BEGIN/COMMIT/ROLLBACK wrapper — the Postgres equivalent of firestore.runTransaction(). */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
