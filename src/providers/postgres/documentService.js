/**
 * Handover document archive (postgres) — stores generated PDFs and uploaded
 * signed scans per employee. Content is kept in the database (BYTEA), so it is
 * covered by the same auth/RBAC and DB backups as the rest of the data; no
 * blob leaves the server unless an external provider is configured.
 */
const { query } = require('./pool');
const { isUuid } = require('./rowMapper');
const { HttpError } = require('../../utils/httpError');

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per document

async function saveDocument({ handoverId, employeeId, employeeName, kind, filename, mime, buffer, uploadedBy, uploadedByName }) {
  if (!isUuid(employeeId)) throw HttpError.badRequest('A valid employeeId is required');
  if (!buffer || !buffer.length) throw HttpError.badRequest('Empty document');
  if (buffer.length > MAX_BYTES) throw HttpError.badRequest('Document exceeds 8MB');

  const { rows } = await query(
    `INSERT INTO handover_documents
       (handover_id, employee_id, employee_name, kind, filename, mime, byte_size, content, uploaded_by, uploaded_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, filename, kind, byte_size AS "byteSize", created_at AS "createdAt"`,
    [handoverId && isUuid(handoverId) ? handoverId : null, employeeId, employeeName || null,
     kind, filename, mime, buffer.length, buffer, uploadedBy || null, uploadedByName || null]
  );
  return rows[0];
}

async function listByEmployee(employeeId) {
  if (!isUuid(employeeId)) return [];
  const { rows } = await query(
    `SELECT id, handover_id AS "handoverId", employee_name AS "employeeName", kind,
            filename, mime, byte_size AS "byteSize", uploaded_by_name AS "uploadedByName",
            created_at AS "createdAt"
     FROM handover_documents WHERE employee_id = $1 ORDER BY created_at DESC`,
    [employeeId]
  );
  return rows;
}

async function getDocument(id) {
  if (!isUuid(id)) throw HttpError.notFound('Document not found');
  const { rows } = await query(
    'SELECT filename, mime, content FROM handover_documents WHERE id = $1', [id]
  );
  if (!rows[0]) throw HttpError.notFound('Document not found');
  return { filename: rows[0].filename, mime: rows[0].mime, buffer: rows[0].content };
}

async function deleteDocument(id) {
  if (!isUuid(id)) throw HttpError.notFound('Document not found');
  const { rowCount } = await query('DELETE FROM handover_documents WHERE id = $1', [id]);
  if (!rowCount) throw HttpError.notFound('Document not found');
  return { id };
}

/* ---- Repair paperwork attached to maintenance logs (per asset) ---- */

async function saveMaintenanceDoc({ maintenanceId, assetId, assetTag, filename, mime, buffer, uploadedBy, uploadedByName }) {
  if (!isUuid(assetId)) throw HttpError.badRequest('A valid assetId is required');
  if (!buffer || !buffer.length) throw HttpError.badRequest('Empty document');
  if (buffer.length > MAX_BYTES) throw HttpError.badRequest('Document exceeds 8MB');
  const { rows } = await query(
    `INSERT INTO maintenance_documents
       (maintenance_id, asset_id, asset_tag, filename, mime, byte_size, content, uploaded_by, uploaded_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, maintenance_id AS "maintenanceId", filename, mime, byte_size AS "byteSize", created_at AS "createdAt"`,
    [maintenanceId && isUuid(maintenanceId) ? maintenanceId : null, assetId, assetTag || null,
     filename, mime, buffer.length, buffer, uploadedBy || null, uploadedByName || null]
  );
  return rows[0];
}

const MAINT_DOC_COLS = `id, maintenance_id AS "maintenanceId", asset_id AS "assetId", filename, mime,
  byte_size AS "byteSize", uploaded_by_name AS "uploadedByName", created_at AS "createdAt"`;

async function listMaintenanceDocsByAsset(assetId) {
  if (!isUuid(assetId)) return [];
  const { rows } = await query(
    `SELECT ${MAINT_DOC_COLS} FROM maintenance_documents WHERE asset_id = $1 ORDER BY created_at DESC`, [assetId]
  );
  return rows;
}

async function listMaintenanceDocsByLog(maintenanceId) {
  if (!isUuid(maintenanceId)) return [];
  const { rows } = await query(
    `SELECT ${MAINT_DOC_COLS} FROM maintenance_documents WHERE maintenance_id = $1 ORDER BY created_at DESC`, [maintenanceId]
  );
  return rows;
}

async function getMaintenanceDoc(id) {
  if (!isUuid(id)) throw HttpError.notFound('Document not found');
  const { rows } = await query('SELECT filename, mime, content FROM maintenance_documents WHERE id = $1', [id]);
  if (!rows[0]) throw HttpError.notFound('Document not found');
  return { filename: rows[0].filename, mime: rows[0].mime, buffer: rows[0].content };
}

async function deleteMaintenanceDoc(id) {
  if (!isUuid(id)) throw HttpError.notFound('Document not found');
  const { rowCount } = await query('DELETE FROM maintenance_documents WHERE id = $1', [id]);
  if (!rowCount) throw HttpError.notFound('Document not found');
  return { id };
}

module.exports = {
  saveDocument, listByEmployee, getDocument, deleteDocument,
  saveMaintenanceDoc, listMaintenanceDocsByAsset, listMaintenanceDocsByLog, getMaintenanceDoc, deleteMaintenanceDoc,
};
