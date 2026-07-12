/** Handover & maintenance document archive (filesystem + legacy BYTEA). */
const { query } = require('./pool');
const { mapRow, mapRows, isUuid } = require('./rowMapper');
const { HttpError } = require('../../utils/httpError');
const docStorage = require('../../utils/docStorage');

function loadBuffer(row) {
  if (row.storage_path) {
    const buf = docStorage.readBuffer(row.storage_path);
    if (buf) return buf;
  }
  return row.content || null;
}

async function saveDocument({
  handoverId, employeeId, employeeName, kind, filename, mime, buffer, uploadedBy, uploadedByName,
}) {
  if (!employeeId || !filename || !buffer) {
    throw HttpError.badRequest('employeeId, filename and file content are required');
  }
  if (!isUuid(employeeId)) throw HttpError.notFound(`Employee ${employeeId} not found`);

  const { rows } = await query(
    `INSERT INTO handover_documents
       (handover_id, employee_id, employee_name, kind, filename, mime, byte_size, content, storage_path,
        uploaded_by, uploaded_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,$8,$9)
     RETURNING id`,
    [
      handoverId || null, employeeId, employeeName || null, kind || 'scan',
      filename, mime || 'application/octet-stream', buffer.length,
      uploadedBy || null, uploadedByName || null,
    ]
  );
  const id = rows[0].id;
  const storagePath = docStorage.writeBuffer('handover', id, buffer);
  await query('UPDATE handover_documents SET storage_path = $2 WHERE id = $1', [id, storagePath]);

  return {
    id, handoverId: handoverId || null, employeeId, employeeName, kind: kind || 'scan',
    filename, mime: mime || 'application/octet-stream', byteSize: buffer.length,
    uploadedBy, uploadedByName, createdAt: new Date().toISOString(),
  };
}

async function listByEmployee(employeeId) {
  if (!isUuid(employeeId)) return [];
  const { rows } = await query(
    'SELECT id, handover_id, employee_id, employee_name, kind, filename, mime, byte_size, uploaded_by_name, created_at FROM handover_documents WHERE employee_id = $1 ORDER BY created_at DESC',
    [employeeId]
  );
  return mapRows(rows);
}

async function getDocument(docId) {
  if (!isUuid(docId)) throw HttpError.notFound(`Document ${docId} not found`);
  const { rows } = await query('SELECT * FROM handover_documents WHERE id = $1', [docId]);
  if (!rows[0]) throw HttpError.notFound(`Document ${docId} not found`);
  const buffer = loadBuffer(rows[0]);
  if (!buffer) throw HttpError.notFound(`Document file missing for ${docId}`);
  return { ...mapRow(rows[0]), buffer };
}

async function deleteDocument(docId) {
  if (!isUuid(docId)) throw HttpError.notFound(`Document ${docId} not found`);
  const { rows } = await query(
    'DELETE FROM handover_documents WHERE id = $1 RETURNING storage_path',
    [docId]
  );
  if (!rows[0]) throw HttpError.notFound(`Document ${docId} not found`);
  docStorage.deleteFile(rows[0].storage_path);
  return { id: docId, deleted: true };
}

/* ---- Maintenance repair paperwork ---- */

async function saveMaintenanceDoc({
  maintenanceId, assetId, assetTag, filename, mime, buffer, uploadedBy, uploadedByName,
}) {
  if (!assetId || !filename || !buffer) {
    throw HttpError.badRequest('assetId, filename and file content are required');
  }

  const { rows } = await query(
    `INSERT INTO maintenance_documents
       (maintenance_id, asset_id, asset_tag, filename, mime, byte_size, content, storage_path,
        uploaded_by, uploaded_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL,$7,$8)
     RETURNING id`,
    [
      maintenanceId || null, assetId, assetTag || null,
      filename, mime || 'application/octet-stream', buffer.length,
      uploadedBy || null, uploadedByName || null,
    ]
  );
  const id = rows[0].id;
  const storagePath = docStorage.writeBuffer('maintenance', id, buffer);
  await query('UPDATE maintenance_documents SET storage_path = $2 WHERE id = $1', [id, storagePath]);

  return {
    id, maintenanceId: maintenanceId || null, assetId, assetTag, filename,
    mime: mime || 'application/octet-stream', byteSize: buffer.length,
    uploadedBy, uploadedByName, createdAt: new Date().toISOString(),
  };
}

async function listMaintenanceDocsByAsset(assetId) {
  if (!isUuid(assetId)) return [];
  const { rows } = await query(
    'SELECT id, maintenance_id, asset_id, asset_tag, filename, mime, byte_size, uploaded_by_name, created_at FROM maintenance_documents WHERE asset_id = $1 ORDER BY created_at DESC',
    [assetId]
  );
  return mapRows(rows);
}

async function listMaintenanceDocsByLog(maintenanceId) {
  if (!isUuid(maintenanceId)) return [];
  const { rows } = await query(
    'SELECT id, maintenance_id, asset_id, asset_tag, filename, mime, byte_size, uploaded_by_name, created_at FROM maintenance_documents WHERE maintenance_id = $1 ORDER BY created_at DESC',
    [maintenanceId]
  );
  return mapRows(rows);
}

async function getMaintenanceDoc(docId) {
  if (!isUuid(docId)) throw HttpError.notFound(`Document ${docId} not found`);
  const { rows } = await query('SELECT * FROM maintenance_documents WHERE id = $1', [docId]);
  if (!rows[0]) throw HttpError.notFound(`Document ${docId} not found`);
  const buffer = loadBuffer(rows[0]);
  if (!buffer) throw HttpError.notFound(`Document file missing for ${docId}`);
  return { ...mapRow(rows[0]), buffer };
}

async function deleteMaintenanceDoc(docId) {
  if (!isUuid(docId)) throw HttpError.notFound(`Document ${docId} not found`);
  const { rows } = await query(
    'DELETE FROM maintenance_documents WHERE id = $1 RETURNING storage_path',
    [docId]
  );
  if (!rows[0]) throw HttpError.notFound(`Document ${docId} not found`);
  docStorage.deleteFile(rows[0].storage_path);
  return { id: docId, deleted: true };
}

module.exports = {
  saveDocument, listByEmployee, getDocument, deleteDocument,
  saveMaintenanceDoc, listMaintenanceDocsByAsset, listMaintenanceDocsByLog,
  getMaintenanceDoc, deleteMaintenanceDoc,
};
