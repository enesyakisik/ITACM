const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { maintenanceService } = require('../services');

router.use(authenticate, requireRole('Admin', 'Helpdesk'));

/** GET /api/maintenance — repair logs; ?open=true for in-flight repairs, ?assetId= per asset. */
router.get('/', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await maintenanceService.listMaintenanceLogs(req.query) });
}));

/** POST /api/maintenance — send an asset to repair (creates log, flips status, audits). */
router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await maintenanceService.sendToRepair(req.body, req.user) });
}));

/** PUT /api/maintenance/:id/close — asset returned from service; body: { cost?, resolutionNote?, scrap? } */
router.put('/:id/close', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await maintenanceService.closeRepair(req.params.id, req.body, req.user) });
}));

/** POST /api/maintenance/:id/note — add a repair progress note (goes to device history too). */
router.post('/:id/note', asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await maintenanceService.addRepairNote(req.params.id, req.body, req.user) });
}));

module.exports = router;
