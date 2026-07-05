/** Consumable service — Consumables screen. Stock movements are transactional. */
const { db, FieldValue, COLLECTIONS } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

async function listConsumables() {
  const snap = await db.collection(COLLECTIONS.CONSUMABLES).orderBy('itemName').get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      lowStock: (data.totalStock ?? 0) <= (data.minimumStockAlertLevel ?? 0),
    };
  });
}

async function createConsumable({ itemName, totalStock = 0, minimumStockAlertLevel = 0 }) {
  if (!itemName) throw HttpError.badRequest('itemName is required');
  const ref = await db.collection(COLLECTIONS.CONSUMABLES).add({
    itemName,
    totalStock: Number(totalStock) || 0,
    minimumStockAlertLevel: Number(minimumStockAlertLevel) || 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, itemName };
}

/** Atomically consume (negative delta) or restock (positive delta); stock can never go below zero. */
async function adjustStock(consumableId, delta) {
  const change = Number(delta);
  if (!Number.isInteger(change) || change === 0) {
    throw HttpError.badRequest('delta must be a non-zero integer');
  }

  const ref = db.collection(COLLECTIONS.CONSUMABLES).doc(consumableId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw HttpError.notFound(`Consumable ${consumableId} not found`);
    const { totalStock = 0, minimumStockAlertLevel = 0, itemName } = snap.data();

    const next = totalStock + change;
    if (next < 0) throw HttpError.conflict(`${itemName}: only ${totalStock} in stock, cannot remove ${-change}`);

    t.update(ref, { totalStock: next });
    return { id: consumableId, itemName, totalStock: next, lowStock: next <= minimumStockAlertLevel };
  });
}

module.exports = { listConsumables, createConsumable, adjustStock };
