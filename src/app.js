/** Express app shared by every runtime: local Node, Docker, and Vercel. */
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // correct req.ip behind reverse proxies

  // Baseline security headers (no external dependency needed).
  // CSP allows only our own code plus Google Fonts and — for firebase mode
  // client login — the Firebase Web SDK and its auth endpoints.
  const CSP = [
    "default-src 'self'",
    "script-src 'self' https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': CSP,
      'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });

  // Coarse abuse guard for the whole API: 1000 requests / 5 min / IP.
  const apiHits = new Map();
  app.use('/api', (req, res, next) => {
    const now = Date.now();
    let entry = apiHits.get(req.ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + 5 * 60 * 1000 };
      apiHits.set(req.ip, entry);
    }
    if (++entry.count > 1000) {
      return res.status(429).json({ success: false, error: 'Too many requests — slow down' });
    }
    if (apiHits.size > 10000) apiHits.clear(); // memory guard
    next();
  });

  // CORS: same-origin only unless CORS_ORIGINS is configured explicitly.
  app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));

  // 1MB JSON everywhere, except the document-scan upload route which has its
  // own larger (12MB) parser — otherwise this global parser would reject the
  // scan before the route is reached.
  const jsonSmall = express.json({ limit: '1mb' });
  app.use((req, res, next) => {
    if (req.method === 'POST' && /^\/api\/employees\/[^/]+\/documents\/?$/.test(req.path)) return next();
    return jsonSmall(req, res, next);
  });

  // Built-in web UI (public/) — served by the same process, no build step.
  app.use(express.static(PUBLIC_DIR));

  app.get('/api/health', (req, res) =>
    res.json({ success: true, service: 'itacm-backend', backend: config.backend })
  );

  // Public bootstrap info for the UI: backend, branding, onboarding state,
  // and (optionally) the Firebase *web* config — no secrets here.
  app.get('/api/config', async (req, res) => {
    let firebaseWebConfig = null;
    if (config.firebaseWebConfig) {
      try { firebaseWebConfig = JSON.parse(config.firebaseWebConfig); } catch { /* ignore */ }
    }
    let settings = { companyName: 'IT Asset Control Pro', companyLogo: null, onboarded: true };
    try { settings = await require('./providers').settingsService.getSettings(); } catch { /* pre-migration */ }
    res.json({ success: true, data: { backend: config.backend, firebaseWebConfig, ...settings } });
  });

  app.use('/api', require('./routes/setup.routes'));
  app.use('/api/auth', require('./routes/auth.routes'));
  app.use('/api/dashboard', require('./routes/dashboard.routes'));
  app.use('/api/assets', require('./routes/assets.routes'));
  app.use('/api/employees', require('./routes/employees.routes'));
  app.use('/api/handovers', require('./routes/handovers.routes'));
  app.use('/api/maintenance', require('./routes/maintenance.routes'));
  app.use('/api/licenses', require('./routes/licenses.routes'));
  app.use('/api/consumables', require('./routes/consumables.routes'));
  app.use('/api/catalog', require('./routes/catalog.routes'));
  app.use('/api/documents', require('./routes/documents.routes'));

  // API 404s stay JSON; anything else falls back to the SPA shell.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return notFoundHandler(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
  app.use(errorHandler);
  return app;
}

/**
 * Default export: a lazy request handler.
 *
 * Vercel's Express framework preset auto-detects this file as the server
 * entrypoint and requires the DEFAULT export to be a function/app —
 * exporting only { createApp } made every deployment crash with
 * "Invalid export found in module /var/task/src/app.js".
 *
 * The handler builds the app on first request and, in postgres mode, runs
 * the idempotent schema migration once per cold start.
 */
let _app = null;
let _ready = null;

async function handler(req, res) {
  if (!_app) _app = createApp();
  const providers = require('./providers');
  if (providers.ensureDatabase) {
    if (!_ready) _ready = providers.ensureDatabase();
    await _ready;
  }
  return _app(req, res);
}

module.exports = handler;
module.exports.createApp = createApp; // named import used by server.js / api/index.js
