/**
 * Maintenance service — Repair/Maintenance log screen.
 *
 * Sending an asset to repair and receiving it back are transactional so the
 * asset status, the open maintenance log, and the audit trail never diverge.
 */
const { db, FieldValue, Timestamp, COLLECTIONS, ASSET_STATUS } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

/** Open a repair ticket: asset -> "In Repair", create log, audit. */
async function sendToRepair({ assetId, serviceCompany, issueDescription, cost = 0 }, itUser) {
  if (!assetId || !serviceCompany || !issueDescription) {
    throw HttpError.badRequest('assetId, serviceCompany and issueDescription are required');
  }

  const assetRef = db.collection(COLLECTIONS.ASSETS).doc(assetId);

  return db.runTransaction(async (t) => {
    const snap = await t.get(assetRef);
    if (!snap.exists) throw HttpError.notFound(`Asset ${assetId} not found`);
    const asset = snap.data();

    if (asset.status === ASSET_STATUS.IN_REPAIR) {
      throw HttpError.conflict(`Asset ${asset.assetTag} is already in repair`);
    }
    if (asset.status === ASSET_STATUS.SCRAP) {
      throw HttpError.conflict(`Asset ${asset.assetTag} is scrapped and cannot be repaired`);
    }

    const logRef = db.collection(COLLECTIONS.MAINTENANCE_LOGS).doc();
    t.set(logRef, {
      assetId,
      assetTag: asset.assetTag,
      serviceCompany,
      issueDescription,
      cost: Number(cost) || 0,
      sentDate: FieldValue.serverTimestamp(),
      returnDate: null,
      // remember where it was so the return flow can restore assignment state
      previousStatus: asset.status,
      previousEmployee: asset.currentEmployee || null,
    });

    t.update(assetRef, { status: ASSET_STATUS.IN_REPAIR, updatedAt: FieldValue.serverTimestamp() });

    t.set(db.collection(COLLECTIONS.ASSET_HISTORY).doc(), {
      assetId,
      assetTag: asset.assetTag,
      employeeId: asset.currentEmployee ? asset.currentEmployee.id : null,
      employeeName: asset.currentEmployee ? asset.currentEmployee.fullName : null,
      actionType: 'sent_to_repair',
      notes: `${serviceCompany}: ${issueDescription}`,
      changedBy: itUser.uid,
      changedByName: itUser.username || itUser.email || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    return { id: logRef.id, assetId, assetTag: asset.assetTag, status: ASSET_STATUS.IN_REPAIR };
  });
}

/** Close a repair ticket: set returnDate/cost, restore the asset's pre-repair state. */
async function closeRepair(logId, { cost, resolutionNote, scrap = false }, itUser) {
  const logRef = db.collection(COLLECTIONS.MAINTENANCE_LOGS).doc(logId);

  return db.runTransaction(async (t) => {
    const logSnap = await t.get(logRef);
    if (!logSnap.exists) throw HttpError.notFound(`Maintenance log ${logId} not found`);
    const log = logSnap.data();
    if (log.returnDate) throw HttpError.conflict('This maintenance log is already closed');

    const assetRef = db.collection(COLLECTIONS.ASSETS).doc(log.assetId);
    const assetSnap = await t.get(assetRef);
    if (!assetSnap.exists) throw HttpError.notFound(`Asset ${log.assetId} not found`);

    const restoredStatus = scrap
      ? ASSET_STATUS.SCRAP
      : log.previousStatus === ASSET_STATUS.ASSIGNED && log.previousEmployee
        ? ASSET_STATUS.ASSIGNED
        : ASSET_STATUS.IN_STOCK;

    t.update(logRef, {
      returnDate: FieldValue.serverTimestamp(),
      ...(cost !== undefined ? { cost: Number(cost) || 0 } : {}),
      ...(resolutionNote ? { resolutionNote } : {}),
    });

    t.update(assetRef, {
      status: restoredStatus,
      currentEmployee: restoredStatus === ASSET_STATUS.ASSIGNED ? log.previousEmployee : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    t.set(db.collection(COLLECTIONS.ASSET_HISTORY).doc(), {
      assetId: log.assetId,
      assetTag: log.assetTag,
      employeeId: log.previousEmployee ? log.previousEmployee.id : null,
      employeeName: log.previousEmployee ? log.previousEmployee.fullName : null,
      actionType: 'returned',
      notes: scrap ? `Scrapped after repair. ${resolutionNote || ''}`.trim() : `Returned from ${log.serviceCompany}. ${resolutionNote || ''}`.trim(),
      changedBy: itUser.uid,
      changedByName: itUser.username || itUser.email || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    return { id: logId, assetId: log.assetId, assetTag: log.assetTag, status: restoredStatus };
  });
}

/** Append a progress note to a repair log; also lands in the asset's history. */
async function addRepairNote(logId, { note }, itUser) {
  if (!note || !String(note).trim()) throw HttpError.badRequest('note is required');
  const logRef = db.collection(COLLECTIONS.MAINTENANCE_LOGS).doc(logId);

  return db.runTransaction(async (t) => {
    const snap = await t.get(logRef);
    if (!snap.exists) throw HttpError.notFound(`Maintenance log ${logId} not found`);
    const log = snap.data();

    const entry = {
      note: String(note).trim(),
      by: itUser.username || itUser.email,
      byUid: itUser.uid,
      at: new Date().toISOString(),
    };
    t.update(logRef, { progressNotes: FieldValue.arrayUnion(entry) });
    t.set(db.collection(COLLECTIONS.ASSET_HISTORY).doc(), {
      assetId: log.assetId,
      assetTag: log.assetTag,
      employeeId: log.previousEmployee ? log.previousEmployee.id : null,
      employeeName: log.previousEmployee ? log.previousEmployee.fullName : null,
      actionType: 'repair_update',
      notes: `${log.serviceCompany}: ${entry.note}`,
      changedBy: itUser.uid,
      changedByName: itUser.username || itUser.email || null,
      timestamp: FieldValue.serverTimestamp(),
    });
    return { id: logId, assetTag: log.assetTag, entry };
  });
}

async function listMaintenanceLogs({ open, assetId, limit = 100 } = {}) {
  let q = db.collection(COLLECTIONS.MAINTENANCE_LOGS);
  if (assetId) q = q.where('assetId', '==', assetId);
  if (open === 'true' || open === true) q = q.where('returnDate', '==', null);
  const snap = await q.orderBy('sentDate', 'desc').limit(Math.min(Number(limit) || 100, 500)).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = { sendToRepair, closeRepair, listMaintenanceLogs, addRepairNote };
