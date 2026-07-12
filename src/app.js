/** Express app — served by server.js (local & Docker). */
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

  // Baseline security headers (no external dependency needed). CSP allows
  // only our own code plus Google Fonts.
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "connect-src 'self'",
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
    // Document-upload routes carry base64 scans and use their own 12MB parser;
    // skip the small global parser so it doesn't reject them first.
    if (req.method === 'POST' && /^\/api\/(employees|maintenance)\/[^/]+\/documents\/?$/.test(req.path)) return next();
    if (req.method === 'POST' && req.path === '/api/import/inventory') return next(); // big CSV payloads
    return jsonSmall(req, res, next);
  });

  // Built-in web UI (public/) — served by the same process, no build step.
  app.use(express.static(PUBLIC_DIR));

  // Liveness + DB readiness. Returns 503 when the database can't answer so that
  // Docker/orchestrator healthchecks detect a degraded API (process up, DB down).
  app.get('/api/health', async (req, res) => {
    const connected = await require('./providers').ping();
    res.status(connected ? 200 : 503).json({
      success: connected,
      service: 'itacm-backend',
      backend: config.backend,
      db: { connected },
    });
  });

  // Public bootstrap info for the UI: branding + onboarding state (no secrets).
  app.get('/api/config', async (req, res) => {
    // Default onboarded=false so a not-yet-set-up instance reaches the wizard;
    // only a successful read flips it to true.
    let settings = { companyName: 'IT Asset Control Pro', companyLogo: null, onboarded: false };
    let configError = null;
    try {
      settings = await require('./providers').settingsService.getSettings();
    } catch (err) {
      configError = 'Database unavailable: ' + err.message;
    }
    res.json({ success: true, data: { backend: config.backend, configError, ...settings } });
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
  app.use('/api/counts', require('./routes/counts.routes'));
  app.use('/api/lines', require('./routes/lines.routes'));
  app.use('/api/import', require('./routes/import.routes'));

  // API 404s stay JSON; anything else falls back to the SPA shell.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return notFoundHandler(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
