const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { catalogService, settingsService } = require('../services');
const { HttpError } = require('../utils/httpError');

router.use(authenticate);

/** GET /api/catalog — brand/model catalog feeding the asset form (all roles). */
router.get('/', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await catalogService.listCatalog() });
}));

/** POST /api/catalog — add a brand/model entry (Admin/Helpdesk). */
router.post('/', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await catalogService.addCatalogEntry(req.body) });
}));

/** POST /api/catalog/import — bootstrap the catalog from existing assets (Admin/Helpdesk). */
router.post('/import', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await catalogService.importFromAssets() });
}));

/** DELETE /api/catalog/:id — remove an entry (Admin/Helpdesk). */
router.delete('/:id', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await catalogService.removeCatalogEntry(req.params.id) });
}));

/* ---- Office locations (stored in settings, managed from the Catalog UI) ---- */

/** GET /api/catalog/locations — location list + default (all roles). */
router.get('/locations', asyncHandler(async (req, res) => {
  const s = await settingsService.getSettings();
  res.json({ success: true, data: { locations: s.locations, defaultLocation: s.defaultLocation } });
}));

/** POST /api/catalog/locations — add a location (Admin/Helpdesk). */
router.post('/locations', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!name || name.length > 60) throw HttpError.badRequest('Location name is required (max 60 chars)');
  const s = await settingsService.getSettings();
  if (s.locations.some((l) => l.toLowerCase() === name.toLowerCase())) {
    throw HttpError.conflict(`Location "${name}" already exists`);
  }
  const saved = await settingsService.saveSettings({ locations: [...s.locations, name] });
  res.status(201).json({ success: true, data: { locations: saved.locations, defaultLocation: saved.defaultLocation } });
}));

/** PUT /api/catalog/locations/default — set the default location (Admin/Helpdesk). */
router.put('/locations/default', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  const name = (req.body || {}).name ?? null;
  const s = await settingsService.getSettings();
  if (name !== null && !s.locations.includes(name)) throw HttpError.badRequest('Unknown location');
  const saved = await settingsService.saveSettings({ defaultLocation: name });
  res.json({ success: true, data: { locations: saved.locations, defaultLocation: saved.defaultLocation } });
}));

/** DELETE /api/catalog/locations/:name — remove a location (Admin/Helpdesk). */
router.delete('/locations/:name', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  const name = req.params.name;
  const s = await settingsService.getSettings();
  if (!s.locations.includes(name)) throw HttpError.notFound(`Location "${name}" not found`);
  if (s.locations.length <= 1) throw HttpError.badRequest('At least one location must remain');
  const saved = await settingsService.saveSettings({
    locations: s.locations.filter((l) => l !== name),
    defaultLocation: s.defaultLocation === name ? null : undefined,
  });
  res.json({ success: true, data: { locations: saved.locations, defaultLocation: saved.defaultLocation } });
}));

module.exports = router;
