/**
 * Asset service — Hardware Inventory table backend.
 *
 * assetTag uniqueness is enforced inside a transaction (the Admin SDK allows
 * queries within transactions), so two concurrent creates with the same tag
 * cannot both commit.
 */
const { db, FieldValue, Timestamp, COLLECTIONS, ASSET_STATUS } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

const VALID_STATUSES = Object.values(ASSET_STATUS);

function buildQrCodeString(assetTag) {
  // Encoded into the QR label printed on the device; scanning resolves the tag.
  return `ITACPRO|ASSET|${assetTag}`;
}

function sanitizeAssetPayload(body, { partial = false } = {}) {
  const {
    assetTag, serialNumber, brand, model, category,
    macEthernet, macWifi, specs, status, warrantyEndDate, location,
  } = body;

  if (!partial) {
    for (const [name, value] of Object.entries({ serialNumber, brand, model, category })) {
      if (!value || typeof value !== 'string') {
        throw HttpError.badRequest(`Field "${name}" is required and must be a string`);
      }
    }
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    throw HttpError.badRequest(`Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const data = {};
  // Asset tags are system-assigned and immutable: only honored on create.
  if (!partial && assetTag) data.assetTag = String(assetTag).trim();
  if (serialNumber !== undefined) data.serialNumber = serialNumber.trim();
  if (brand !== undefined) data.brand = brand;
  if (model !== undefined) data.model = model;
  if (category !== undefined) data.category = category;
  if (macEthernet !== undefined) data.macEthernet = macEthernet;
  if (macWifi !== undefined) data.macWifi = macWifi;
  if (location !== undefined) data.location = location ? String(location).trim() : null;
  if (status !== undefined) data.status = status;
  if (warrantyEndDate !== undefined) {
    data.warrantyEndDate = warrantyEndDate ? Timestamp.fromDate(new Date(warrantyEndDate)) : null;
  }
  if (body.purchaseDate !== undefined) {
    data.purchaseDate = body.purchaseDate ? Timestamp.fromDate(new Date(body.purchaseDate)) : null;
  }
  if (specs !== undefined) {
    data.specs = {
      cpu: specs?.cpu || null,
      ram: specs?.ram || null,
      storage: specs?.storage || null,
      os: specs?.os || null,
    };
  }
  return data;
}

/** Preview of the next system-assigned tag (actual value fixed at create time). */
async function nextAssetTag() {
  const snap = await db.collection('settings').doc('counters').get();
  const next = ((snap.exists && snap.data().assetTag) || 1000) + 1;
  return 'IT-' + String(next).padStart(4, '0');
}

async function createAsset(body) {
  const data = sanitizeAssetPayload(body);
  const assetsRef = db.collection(COLLECTIONS.ASSETS);
  const counterRef = db.collection('settings').doc('counters');

  return db.runTransaction(async (t) => {
    if (!data.assetTag) {
      // System-assigned sequential tag via an atomic counter document.
      const counterSnap = await t.get(counterRef);
      const next = ((counterSnap.exists && counterSnap.data().assetTag) || 1000) + 1;
      t.set(counterRef, { assetTag: next }, { merge: true });
      data.assetTag = 'IT-' + String(next).padStart(4, '0');
    } else {
      const dupe = await t.get(assetsRef.where('assetTag', '==', data.assetTag).limit(1));
      if (!dupe.empty) {
        throw HttpError.conflict(`Asset tag "${data.assetTag}" is already registered`);
      }
    }

    const docRef = assetsRef.doc();
    t.set(docRef, {
      ...data,
      status: data.status || ASSET_STATUS.IN_STOCK,
      currentEmployee: null,
      qrCodeString: buildQrCodeString(data.assetTag),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { id: docRef.id, assetTag: data.assetTag };
  });
}

async function updateAsset(assetId, body) {
  const data = sanitizeAssetPayload(body, { partial: true });
  if (Object.keys(data).length === 0) {
    throw HttpError.badRequest('No updatable fields provided');
  }

  const assetsRef = db.collection(COLLECTIONS.ASSETS);
  const docRef = assetsRef.doc(assetId);

  return db.runTransaction(async (t) => {
    const snap = await t.get(docRef);
    if (!snap.exists) throw HttpError.notFound(`Asset ${assetId} not found`);
    const current = snap.data();

    // Assignment state transitions must go through handover/maintenance flows
    // so the audit trail and employee counters stay consistent.
    if (data.status === ASSET_STATUS.ASSIGNED && current.status !== ASSET_STATUS.ASSIGNED) {
      throw HttpError.badRequest('Use POST /api/handovers to assign assets');
    }

    t.update(docRef, { ...data, updatedAt: FieldValue.serverTimestamp() });
    return { id: assetId, ...current, ...data };
  });
}

/** List with the filters the Hardware Inventory screen exposes (status tabs, category, employee, search). */
async function listAssets({ status, category, employeeId, search, location, limit = 100, cursor } = {}) {
  let q = db.collection(COLLECTIONS.ASSETS);

  if (status) q = q.where('status', '==', status);
  if (category) q = q.where('category', '==', category);
  if (employeeId) q = q.where('currentEmployee.id', '==', employeeId);
  if (location) q = q.where('location', '==', location);
  const totalSnap = await q.count().get();
  q = q.orderBy('assetTag').limit(Math.min(Number(limit) || 100, 2000));
  if (cursor) q = q.startAfter(cursor);

  const snap = await q.get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Lightweight in-memory search across tag / serial / brand / model.
  if (search) {
    const needle = String(search).toLowerCase();
    items = items.filter((a) =>
      [a.assetTag, a.serialNumber, a.brand, a.model, a.macEthernet, a.macWifi]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }

  return {
    items,
    total: totalSnap.data().count,
    nextCursor: snap.docs.length ? snap.docs[snap.docs.length - 1].get('assetTag') : null,
  };
}

async function getAsset(assetId) {
  const snap = await db.collection(COLLECTIONS.ASSETS).doc(assetId).get();
  if (!snap.exists) throw HttpError.notFound(`Asset ${assetId} not found`);

  const history = await db
    .collection(COLLECTIONS.ASSET_HISTORY)
    .where('assetId', '==', assetId)
    .orderBy('timestamp', 'desc')
    .limit(25)
    .get();

  return {
    id: snap.id,
    ...snap.data(),
    history: history.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

/**
 * Return an assigned asset back to stock (the inverse of a handover line item).
 * Transactionally flips the asset, decrements the employee counter, and audits.
 */
async function returnAsset(assetId, { conditionNote }, itUser) {
  const assetRef = db.collection(COLLECTIONS.ASSETS).doc(assetId);

  return db.runTransaction(async (t) => {
    const snap = await t.get(assetRef);
    if (!snap.exists) throw HttpError.notFound(`Asset ${assetId} not found`);
    const asset = snap.data();

    if (asset.status !== ASSET_STATUS.ASSIGNED || !asset.currentEmployee) {
      throw HttpError.conflict(`Asset ${asset.assetTag} is not currently assigned`);
    }

    const employeeRef = db.collection(COLLECTIONS.EMPLOYEES).doc(asset.currentEmployee.id);
    const employeeSnap = await t.get(employeeRef);

    t.update(assetRef, {
      status: ASSET_STATUS.IN_STOCK,
      currentEmployee: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (employeeSnap.exists) {
      t.update(employeeRef, { activeAssetCount: FieldValue.increment(-1) });
    }

    t.set(db.collection(COLLECTIONS.ASSET_HISTORY).doc(), {
      assetId,
      assetTag: asset.assetTag,
      employeeId: asset.currentEmployee.id,
      employeeName: asset.currentEmployee.fullName,
      actionType: 'returned',
      notes: conditionNote || '',
      changedBy: itUser.uid,
      changedByName: itUser.username || itUser.email || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    return { id: assetId, assetTag: asset.assetTag, status: ASSET_STATUS.IN_STOCK };
  });
}

module.exports = { createAsset, updateAsset, listAssets, getAsset, returnAsset, nextAssetTag };
