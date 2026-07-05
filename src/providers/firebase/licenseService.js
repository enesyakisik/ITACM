/** License service — Software & Licenses screen. Seat allocation is transactional. */
const { db, FieldValue, Timestamp, COLLECTIONS } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

async function listLicenses({ limit = 200 } = {}) {
  const snap = await db.collection(COLLECTIONS.LICENSES)
    .orderBy('expirationDate', 'asc')
    .limit(Math.min(Number(limit) || 200, 1000))
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function createLicense({ softwareName, vendor, licenseKey, totalSeats, expirationDate }) {
  if (!softwareName || !licenseKey) throw HttpError.badRequest('softwareName and licenseKey are required');
  const seats = Number(totalSeats);
  if (!Number.isInteger(seats) || seats < 1) throw HttpError.badRequest('totalSeats must be a positive integer');
  if (!expirationDate) throw HttpError.badRequest('expirationDate is required');

  const ref = await db.collection(COLLECTIONS.LICENSES).add({
    softwareName,
    vendor: vendor || null,
    licenseKey,
    totalSeats: seats,
    usedSeats: 0,
    expirationDate: Timestamp.fromDate(new Date(expirationDate)),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, softwareName, totalSeats: seats, usedSeats: 0 };
}

/** Atomically claim or release seats; over-allocation is rejected inside the transaction. */
async function adjustSeats(licenseId, delta) {
  const change = Number(delta);
  if (!Number.isInteger(change) || change === 0) {
    throw HttpError.badRequest('delta must be a non-zero integer (positive = claim, negative = release)');
  }

  const ref = db.collection(COLLECTIONS.LICENSES).doc(licenseId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw HttpError.notFound(`License ${licenseId} not found`);
    const { usedSeats = 0, totalSeats = 0, softwareName } = snap.data();

    const next = usedSeats + change;
    if (next < 0) throw HttpError.conflict(`Cannot release ${-change} seats — only ${usedSeats} in use`);
    if (next > totalSeats) {
      throw HttpError.conflict(`${softwareName}: no seats left (${usedSeats}/${totalSeats} used)`);
    }

    t.update(ref, { usedSeats: next });
    return { id: licenseId, softwareName, usedSeats: next, totalSeats };
  });
}

const ASSIGNMENTS = 'licenseAssignments';

/**
 * Software zimmet: assign one seat of a license to an employee.
 * Transactional — seat count and the assignment doc can never diverge.
 */
async function assignLicense(licenseId, employeeId, itUser) {
  if (!employeeId) throw HttpError.badRequest('A valid employeeId is required');

  const licRef = db.collection(COLLECTIONS.LICENSES).doc(licenseId);
  const empRef = db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId);
  const dupeQuery = db.collection(ASSIGNMENTS)
    .where('licenseId', '==', licenseId)
    .where('employeeId', '==', employeeId)
    .where('revokedAt', '==', null)
    .limit(1);

  return db.runTransaction(async (t) => {
    const [licSnap, empSnap, dupeSnap] = await Promise.all([t.get(licRef), t.get(empRef), t.get(dupeQuery)]);

    if (!licSnap.exists) throw HttpError.notFound(`License ${licenseId} not found`);
    const lic = licSnap.data();
    if (!empSnap.exists) throw HttpError.notFound(`Employee ${employeeId} not found`);
    const emp = empSnap.data();
    if (emp.status !== 'Active') {
      throw HttpError.conflict(`Employee ${emp.fullName} is inactive — cannot receive software`);
    }
    if (!dupeSnap.empty) {
      throw HttpError.conflict(`${lic.softwareName} is already assigned to ${emp.fullName}`);
    }
    if ((lic.usedSeats || 0) >= lic.totalSeats) {
      throw HttpError.conflict(`${lic.softwareName}: no seats left (${lic.usedSeats}/${lic.totalSeats} used)`);
    }

    t.update(licRef, { usedSeats: FieldValue.increment(1) });
    const aRef = db.collection(ASSIGNMENTS).doc();
    t.set(aRef, {
      licenseId,
      softwareName: lic.softwareName,
      employeeId,
      employeeName: emp.fullName,
      assignedBy: itUser.uid,
      assignedByName: itUser.username || itUser.email || null,
      assignedAt: FieldValue.serverTimestamp(),
      revokedAt: null,
      revokedBy: null,
    });
    return { id: aRef.id, licenseId, softwareName: lic.softwareName, employeeId, employeeName: emp.fullName };
  });
}

/** Revoke a software assignment (zimmet düşürme) and free the seat. */
async function revokeAssignment(assignmentId, itUser) {
  const aRef = db.collection(ASSIGNMENTS).doc(assignmentId);

  return db.runTransaction(async (t) => {
    const aSnap = await t.get(aRef);
    if (!aSnap.exists) throw HttpError.notFound(`Assignment ${assignmentId} not found`);
    const a = aSnap.data();
    if (a.revokedAt) throw HttpError.conflict('This assignment is already revoked');

    const licRef = db.collection(COLLECTIONS.LICENSES).doc(a.licenseId);
    const licSnap = await t.get(licRef);

    t.update(aRef, { revokedAt: FieldValue.serverTimestamp(), revokedBy: itUser.uid });
    if (licSnap.exists) {
      t.update(licRef, { usedSeats: Math.max((licSnap.data().usedSeats || 0) - 1, 0) });
    }
    return { id: assignmentId, licenseId: a.licenseId, softwareName: a.softwareName, employeeName: a.employeeName };
  });
}

/** List assignments filtered by license and/or employee; active only by default. */
async function listAssignments({ licenseId, employeeId, includeRevoked } = {}) {
  let q = db.collection(ASSIGNMENTS);
  if (licenseId) q = q.where('licenseId', '==', licenseId);
  if (employeeId) q = q.where('employeeId', '==', employeeId);
  if (!(includeRevoked === 'true' || includeRevoked === true)) q = q.where('revokedAt', '==', null);

  const snap = await q.limit(5000).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.assignedAt?.toMillis?.() || 0) - (a.assignedAt?.toMillis?.() || 0));
}

module.exports = { listLicenses, createLicense, adjustSeats, assignLicense, revokeAssignment, listAssignments };
