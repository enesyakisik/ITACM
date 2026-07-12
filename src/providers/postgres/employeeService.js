/** Employee service (postgres) — Employee Directory + Handover Employee Selector. */
const { query } = require('./pool');
const { mapRow, mapRows, isUuid } = require('./rowMapper');
const { HttpError } = require('../../utils/httpError');

const STATUSES = ['Active', 'Inactive'];

async function listEmployees({ status, search, limit = 200, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) {
    if (!STATUSES.includes(status)) throw HttpError.badRequest('status must be Active or Inactive');
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(full_name ILIKE $${params.length} OR email ILIKE $${params.length} ` +
      `OR department ILIKE $${params.length} OR title ILIKE $${params.length})`
    );
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  // Cap raised to 10000 so the full directory (and reports) load for large
  // companies; offset supports paging when needed.
  params.push(Math.min(Number(limit) || 200, 10000));
  params.push(Math.max(0, Number(offset) || 0));

  const { rows } = await query(
    `SELECT * FROM employees ${whereSql}
     ORDER BY full_name LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return mapRows(rows);
}

async function getEmployee(id) {
  if (!isUuid(id)) throw HttpError.notFound(`Employee ${id} not found`);
  const { rows } = await query('SELECT * FROM employees WHERE id = $1', [id]);
  if (!rows[0]) throw HttpError.notFound(`Employee ${id} not found`);
  return mapRow(rows[0]);
}

async function createEmployee({ fullName, email, department, title, status = 'Active' }) {
  if (!fullName || !email) throw HttpError.badRequest('fullName and email are required');
  if (!STATUSES.includes(status)) throw HttpError.badRequest('status must be Active or Inactive');

  try {
    const { rows } = await query(
      `INSERT INTO employees (full_name, email, department, title, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [fullName, email.toLowerCase(), department || null, title || null, status]
    );
    return mapRow(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw HttpError.conflict(`An employee with email ${email} already exists`);
    throw err;
  }
}

async function updateEmployee(id, body) {
  if (!isUuid(id)) throw HttpError.notFound(`Employee ${id} not found`);

  const colMap = { fullName: 'full_name', email: 'email', department: 'department', title: 'title', status: 'status' };
  const data = {};
  for (const [key, col] of Object.entries(colMap)) {
    if (body[key] !== undefined) data[col] = body[key];
  }
  if (data.status && !STATUSES.includes(data.status)) {
    throw HttpError.badRequest('status must be Active or Inactive');
  }
  if (Object.keys(data).length === 0) throw HttpError.badRequest('No updatable fields provided');

  const { rows } = await query('SELECT * FROM employees WHERE id = $1', [id]);
  const current = rows[0];
  if (!current) throw HttpError.notFound(`Employee ${id} not found`);

  // Offboarding guard: an employee still holding assets cannot be deactivated.
  if (data.status === 'Inactive' && current.active_asset_count > 0) {
    throw HttpError.conflict(
      `${current.full_name} still holds ${current.active_asset_count} asset(s). Return them before deactivating.`
    );
  }

  const cols = Object.keys(data);
  const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const updated = await query(
    `UPDATE employees SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...cols.map((c) => data[c])]
  );
  return mapRow(updated.rows[0]);
}

/** Full activity history of one employee: devices + mobile line zimmet events. */
async function getEmployeeHistory(id, limit = 100) {
  if (!isUuid(id)) throw HttpError.notFound(`Employee ${id} not found`);
  const cap = Math.min(Number(limit) || 100, 500);
  const [devices, lines] = await Promise.all([
    query(
      `SELECT id, asset_tag AS label, action_type, notes, changed_by_name, employee_name, "timestamp",
              'device' AS kind
       FROM asset_history WHERE employee_id = $1
       ORDER BY "timestamp" DESC LIMIT $2`,
      [id, cap]
    ),
    query(
      `SELECT id, phone_number AS label, action_type, notes, changed_by_name, employee_name, "timestamp",
              'line' AS kind
       FROM mobile_line_history WHERE employee_id = $1
       ORDER BY "timestamp" DESC LIMIT $2`,
      [id, cap]
    ).catch(() => ({ rows: [] })), // table may not exist until migrate runs
  ]);
  return [...mapRows(devices.rows), ...mapRows(lines.rows)]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, cap);
}

module.exports = { listEmployees, getEmployee, createEmployee, updateEmployee, getEmployeeHistory };
