const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { documentService } = require('../services');

router.use(authenticate);

/** GET /api/documents/:id/download — stream an archived document (all roles). */
router.get('/:id/download', asyncHandler(async (req, res) => {
  const doc = await documentService.getDocument(req.params.id);
  res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.send(doc.buffer);
}));

/** DELETE /api/documents/:id — remove an archived document (Owner/Admin). */
router.delete('/:id', requireRole('Owner', 'Admin'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await documentService.deleteDocument(req.params.id) });
}));

module.exports = router;
