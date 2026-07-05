/**
 * Handover service — the Handover Operations "basket" flow.
 *
 * executeHandover() is fully atomic via firestore.runTransaction():
 *   1. READ  employee + every asset in the basket (all reads first — Firestore
 *      transactions require reads before writes).
 *   2. VALIDATE every asset is "In Stock"; one locked/assigned/missing asset
 *      aborts the whole basket (automatic rollback, nothing is written).
 *   3. WRITE  the handovers receipt doc, flip each asset to "Assigned" bound
 *      to the employee, increment employees.activeAssetCount by basket size,
 *      and append one assetHistory audit row per asset.
 *
 * Firestore retries the transaction on contention, so two Helpdesk users
 * racing to hand over the same laptop can never both succeed.
 */
const { db, FieldValue, COLLECTIONS, ASSET_STATUS } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

const MAX_BASKET_SIZE = 100; // stay well under Firestore's 500-writes/txn limit

async function executeHandover({ employeeId, documentType = 'single', items }, itUser) {
  if (!employeeId) throw HttpError.badRequest('employeeId is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw HttpError.badRequest('The handover basket is empty');
  }
  if (items.length > MAX_BASKET_SIZE) {
    throw HttpError.badRequest(`Basket exceeds the maximum of ${MAX_BASKET_SIZE} assets`);
  }
  if (!['single', 'separate'].includes(documentType)) {
    throw HttpError.badRequest('documentType must be "single" or "separate"');
  }

  const uniqueAssetIds = new Set(items.map((i) => i.assetId));
  if (uniqueAssetIds.size !== items.length) {
    throw HttpError.badRequest('Duplicate assets in the basket');
  }

  const employeeRef = db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId);
  const assetRefs = items.map((i) => db.collection(COLLECTIONS.ASSETS).doc(i.assetId));

  return db.runTransaction(async (t) => {
    // ---- READ PHASE -------------------------------------------------------
    const [employeeSnap, ...assetSnaps] = await t.getAll(employeeRef, ...assetRefs);

    if (!employeeSnap.exists) throw HttpError.notFound(`Employee ${employeeId} not found`);
    const employee = employeeSnap.data();
    if (employee.status !== 'Active') {
      throw HttpError.conflict(`Employee ${employee.fullName} is inactive — cannot receive assets`);
    }

    // ---- VALIDATE: every basket asset must be In Stock --------------------
    const conflicts = [];
    const validatedAssets = assetSnaps.map((snap, idx) => {
      if (!snap.exists) {
        conflicts.push({ assetId: items[idx].assetId, reason: 'Asset no longer exists' });
        return null;
      }
      const asset = snap.data();
      if (asset.status !== ASSET_STATUS.IN_STOCK) {
        conflicts.push({
          assetId: snap.id,
          assetTag: asset.assetTag,
          reason: `Asset is "${asset.status}"${asset.currentEmployee ? ` (held by ${asset.currentEmployee.fullName})` : ''}`,
        });
        return null;
      }
      return { ref: snap.ref, data: asset, conditionNote: items[idx].conditionNote || '' };
    });

    if (conflicts.length > 0) {
      // Throwing aborts the transaction — Firestore discards all staged writes.
      throw HttpError.conflict('Handover rejected: one or more assets are not In Stock', conflicts);
    }

    // ---- WRITE PHASE (all-or-nothing) --------------------------------------
    const handoverRef = db.collection(COLLECTIONS.HANDOVERS).doc();
    const employeeSummary = { id: employeeSnap.id, fullName: employee.fullName };

    const receiptItems = validatedAssets.map(({ ref, data, conditionNote }) => {
      // 1) Bind the asset to the employee
      t.update(ref, {
        status: ASSET_STATUS.ASSIGNED,
        currentEmployee: employeeSummary,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2) Audit trail row
      t.set(db.collection(COLLECTIONS.ASSET_HISTORY).doc(), {
        assetId: ref.id,
        assetTag: data.assetTag,
        employeeId: employeeSnap.id,
        employeeName: employee.fullName,
        actionType: 'assigned',
        notes: conditionNote,
        changedBy: itUser.uid,
        changedByName: itUser.username || itUser.email || null,
        timestamp: FieldValue.serverTimestamp(),
      });

      // 3) Denormalized line item for the printable receipt (Zimmet Tutanağı)
      return {
        assetId: ref.id,
        assetTag: data.assetTag,
        brand: data.brand,
        model: data.model,
        category: data.category,
        serialNumber: data.serialNumber,
        macAddress: data.macEthernet || data.macWifi || null,
        conditionNote,
      };
    });

    // 4) The receipt document that Print Preview renders
    t.set(handoverRef, {
      employeeId: employeeSnap.id,
      employeeName: employee.fullName,
      itUserId: itUser.uid,
      transactionDate: FieldValue.serverTimestamp(),
      documentType,
      items: receiptItems,
    });

    // 5) Keep the Employee Directory "Assigned Assets" column in sync
    t.update(employeeRef, { activeAssetCount: FieldValue.increment(receiptItems.length) });

    return {
      handoverId: handoverRef.id,
      employee: employeeSummary,
      documentType,
      itemCount: receiptItems.length,
      items: receiptItems,
    };
  });
}

async function getHandover(handoverId) {
  const snap = await db.collection(COLLECTIONS.HANDOVERS).doc(handoverId).get();
  if (!snap.exists) throw HttpError.notFound(`Handover ${handoverId} not found`);
  return { id: snap.id, ...snap.data() };
}

async function listHandovers({ employeeId, limit = 50 } = {}) {
  let q = db.collection(COLLECTIONS.HANDOVERS).orderBy('transactionDate', 'desc');
  if (employeeId) q = db.collection(COLLECTIONS.HANDOVERS)
    .where('employeeId', '==', employeeId)
    .orderBy('transactionDate', 'desc');
  const snap = await q.limit(Math.min(Number(limit) || 50, 200)).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = { executeHandover, getHandover, listHandovers };
