const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { handoverService } = require('../services');

router.use(authenticate);

/**
 * POST /api/handovers — execute the atomic Handover Basket transaction (Admin/Helpdesk).
 * Body: { employeeId, documentType: "single"|"separate",
 *         items: [{ assetId, conditionNote }] }
 * 409 with a per-asset conflict list if any basket item is not "In Stock".
 */
router.post('/', requireRole('Owner', 'Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  const receipt = await handoverService.executeHandover(req.body, req.user);
  // Auto-archive the generated PDF against the employee (best-effort).
  require('../utils/handoverArchive').archiveReceipt(receipt.handoverId, req.user);
  res.status(201).json({ success: true, data: receipt });
}));

/** GET /api/handovers — recent receipts; ?employeeId= filters per employee (all roles). */
router.get('/', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await handoverService.listHandovers(req.query) });
}));

/** GET /api/handovers/:id/pdf — download the receipt as a real PDF file. */
router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const { buildReceiptPdf } = require('../utils/handoverArchive');
  const { buffer, filename } = await buildReceiptPdf(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}));

/** GET /api/handovers/:id — one receipt, feeds the Print Preview (Zimmet Tutanağı). */
router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await handoverService.getHandover(req.params.id) });
}));

module.exports = router;
