const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { catalogService } = require('../services');

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

module.exports = router;
