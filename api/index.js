/**
 * Vercel serverless entry — all /api/* routes are rewritten here (vercel.json).
 * In postgres mode the schema check runs once per cold start (idempotent).
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
