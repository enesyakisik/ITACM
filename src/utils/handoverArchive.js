/**
 * Builds the handover PDF for a receipt and (best-effort) stores it in the
 * per-employee document archive. Shared by the /pdf endpoint and the
 * auto-archive step that runs after every handover.
 */
const { renderHandoverPdfBuffer } = require('./handoverPdf');

async function buildReceiptPdf(handoverId) {
  const { handoverService, employeeService, settingsService } = require('../services');
  const handover = await handoverService.getHandover(handoverId);
  const settings = await settingsService.getSettings();
  let employee = null;
  try {
    employee = (await employeeService.listEmployees({ limit: 1000 }))
      .find((e) => e.id === handover.employeeId) || null;
  } catch { /* render without dept/title */ }

  const formNo = 'HF-' + String(handover.id).slice(0, 8).toUpperCase();
  const buffer = await renderHandoverPdfBuffer({ handover, employee, settings });
  return { handover, buffer, formNo, filename: `zimmet-${formNo}.pdf` };
}

/** Store the generated receipt PDF against the employee (never throws). */
async function archiveReceipt(handoverId, itUser) {
  try {
    const { documentService } = require('../services');
    const { handover, buffer, filename } = await buildReceiptPdf(handoverId);
    await documentService.saveDocument({
      handoverId: handover.id,
      employeeId: handover.employeeId,
      employeeName: handover.employeeName,
      kind: 'generated',
      filename,
      mime: 'application/pdf',
      buffer,
      uploadedBy: itUser && itUser.uid,
      uploadedByName: itUser && (itUser.username || itUser.email),
    });
  } catch (err) {
    // Archiving must never break the handover itself.
    console.error('[archive] failed to store handover PDF:', err.message);
  }
}

module.exports = { buildReceiptPdf, archiveReceipt };
