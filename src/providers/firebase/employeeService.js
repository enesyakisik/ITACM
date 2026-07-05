/** Employee service — Employee Directory screen + the Handover Employee Selector. */
const { db, FieldValue, COLLECTIONS } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

const EMPLOYEE_STATUSES = ['Active', 'Inactive'];

async function listEmployees({ status, search, limit = 200 } = {}) {
  let q = db.collection(COLLECTIONS.EMPLOYEES);
  if (status) {
    if (!EMPLOYEE_STATUSES.includes(status)) throw HttpError.badRequest('status must be Active or Inactive');
    q = q.where('status', '==', status);
  }
  const snap = await q.orderBy('fullName').limit(Math.min(Number(limit) || 200, 1000)).get();

  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (search) {
    const needle = String(search).toLowerCase();
    items = items.filter((e) =>
      [e.fullName, e.email, e.department, e.title].filter(Boolean).some((v) => v.toLowerCase().includes(needle))
    );
  }
  return items;
}

async function createEmployee({ fullName, email, department, title, status = 'Active' }) {
  if (!fullName || !email) throw HttpError.badRequest('fullName and email are required');
  if (!EMPLOYEE_STATUSES.includes(status)) throw HttpError.badRequest('status must be Active or Inactive');

  const ref = await db.collection(COLLECTIONS.EMPLOYEES).add({
    fullName,
    email,
    department: department || null,
    title: title || null,
    status,
    activeAssetCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id, fullName, email, department, title, status, activeAssetCount: 0 };
}

async function updateEmployee(id, body) {
  const allowed = ['fullName', 'email', 'department', 'title', 'status'];
  const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  if (data.status && !EMPLOYEE_STATUSES.includes(data.status)) {
    throw HttpError.badRequest('status must be Active or Inactive');
  }
  if (Object.keys(data).length === 0) throw HttpError.badRequest('No updatable fields provided');

  const ref = db.collection(COLLECTIONS.EMPLOYEES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw HttpError.notFound(`Employee ${id} not found`);

  // Offboarding guard: an employee still holding assets cannot be deactivated.
  if (data.status === 'Inactive' && (snap.data().activeAssetCount || 0) > 0) {
    throw HttpError.conflict(
      `${snap.data().fullName} still holds ${snap.data().activeAssetCount} asset(s). Return them before deactivating.`
    );
  }

  await ref.update(data);
  return { id, ...snap.data(), ...data };
}

/** Full device history of one employee: every assign/return/repair event. */
async function getEmployeeHistory(id, limit = 100) {
  const snap = await db.collection(COLLECTIONS.ASSET_HISTORY)
    .where('employeeId', '==', id)
    .orderBy('timestamp', 'desc')
    .limit(Math.min(Number(limit) || 100, 500))
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = { listEmployees, createEmployee, updateEmployee, getEmployeeHistory };
