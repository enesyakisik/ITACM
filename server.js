/**
 * Node/Docker entry point.
 * In postgres mode the schema is applied and the first Admin is seeded
 * automatically before the HTTP server starts listening.
 */
const config = require('./src/config');

async function main() {
  const providers = require('./src/providers');
  if (providers.ensureDatabase) {
    await providers.ensureDatabase();
  }

  const { createApp } = require('./src/app');
  createApp().listen(config.port, () => {
    console.log(`[itacm] backend=${config.backend} listening on http://localhost:${config.port}`);
    console.log('[itacm] health check: GET /api/health');
  });
}

main().catch((err) => {
  console.error('[itacm] fatal startup error:', err.message);
  process.exit(1);
});
