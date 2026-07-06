/**
 * Handover document archive (firebase) — stores generated PDFs and uploaded
 * signed scans per employee as base64 in Firestore. Firestore documents cap at
 * ~1MB, so files are limited accordingly; larger scans should use the postgres
 * backend or an external storage provider.
 */
const { db, FieldValue } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

const COLL = 'handoverDocuments';
const MAX_BYTES = 700 * 1024; // stay safely under Firestore's 1MB doc limit

async function saveDocument({ handoverId, employeeId, employeeName, kind, filename, mime, buffer, uploadedBy, uploadedByName }) {
  if (!employeeId) throw HttpError.badRequest('A valid employeeId is required');
  if (!buffer || !buffer.length) throw HttpError.badRequest('Empty document');
  if (buffer.length > MAX_BYTES) {
    throw HttpError.badRequest('Document exceeds ~700KB (Firestore limit). Use postgres backend or external storage for large scans.');
  }
  const ref = await db.collection(COLL).add({
    handoverId: handoverId || null,
    employeeId,
    employeeName: employeeName || null,
    kind, filename, mime,
    byteSize: buffer.length,
    contentBase64: buffer.toString('base64'),
    uploadedBy: uploadedBy || null,
    uploadedByName: uploadedByName || null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, filename, kind, byteSize: buffer.length };
}

async function listByEmployee(employeeId) {
  const snap = await db.collection(COLL).where('employeeId', '==', employeeId).get();
  return snap.docs
    .map((d) => {
      const { contentBase64, ...meta } = d.data();
      return { id: d.id, ...meta };
    })
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

async function getDocument(id) {
  const snap = await db.collection(COLL).doc(id).get();
  if (!snap.exists) throw HttpError.notFound('Document not found');
  const d = snap.data();
  return { filename: d.filename, mime: d.mime, buffer: Buffer.from(d.contentBase64, 'base64') };
}

async function deleteDocument(id) {
  await db.collection(COLL).doc(id).delete();
  return { id };
}

module.exports = { saveDocument, listByEmployee, getDocument, deleteDocument };
