/**
 * Onboarding & branding settings.
 *
 * POST /api/setup — PUBLIC but one-shot: only works while the instance has
 * not been onboarded yet. Sets company branding and the Admin credentials,
 * then flips the onboarded flag so it can never run again.
 *
 * PUT /api/settings — Admin-only branding updates afterwards.
 */
const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { authProvider, settingsService } = require('../services');
const { HttpError } = require('../utils/httpError');

router.post('/setup', asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();
  if (settings.onboarded) {
    throw HttpError.forbidden('This instance is already set up. Sign in as Admin to change settings.');
  }

  const { companyName, companyLogo, adminUsername, adminEmail, adminPassword, language } = req.body || {};
  if (!companyName) throw HttpError.badRequest('companyName is required');

  const admin = await authProvider.upsertAdmin({
    username: adminUsername,
    email: adminEmail,
    password: adminPassword,
  });

  const saved = await settingsService.saveSettings({
    companyName,
    companyLogo: companyLogo || undefined,
    language: language || undefined,
    onboarded: true,
  });

  res.status(201).json({
    success: true,
    data: { settings: saved, admin: { email: admin.email, username: admin.username } },
  });
}));

// Branding & company-level settings are Owner-only. Operational lists
// (lifecycles, locations, specOptions) are managed by staff via /api/catalog.
router.put('/settings', authenticate, requireRole('Owner'), asyncHandler(async (req, res) => {
  const { companyName, companyLogo, handoverTerms, defaultLocation, documentStorage, handoverTemplate, language } = req.body || {};
  const saved = await settingsService.saveSettings({
    companyName, companyLogo, handoverTerms, defaultLocation, documentStorage, handoverTemplate, language,
  });
  res.json({ success: true, data: saved });
}));

module.exports = router;
