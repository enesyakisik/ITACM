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

  // Baseline security headers (no external dependency needed)
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });

  app.use(cors(config.corsOrigins.length ? { origin: config.corsOrigins } : undefined));
  app.use(express.json({ limit: '1mb' }));

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

  // API 404s stay JSON; anything else falls back to the SPA shell.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return notFoundHandler(req, res);
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
