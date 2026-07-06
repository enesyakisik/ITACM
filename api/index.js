/**
 * Vercel serverless entry. vercel.json routes EVERY request to this function,
 * and the Express app serves the static UI, the /api routes, and the SPA
 * fallback — exactly like the local/Docker server. In postgres mode the schema
 * check runs once per cold start (idempotent).
 */
const { createApp } = require('../src/app');
const providers = require('../src/providers');

const app = createApp();
let ready = null;

module.exports = async (req, res) => {
  if (providers.ensureDatabase) {
    if (!ready) ready = providers.ensureDatabase();
    await ready;
  }
  return app(req, res);
};
