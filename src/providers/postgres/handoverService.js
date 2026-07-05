/**
 * Handover service (postgres) — the atomic Handover Basket.
 *
 * One SQL transaction with SELECT ... FOR UPDATE row locks:
 * validate every basket asset is "In Stock", create the receipt, flip assets
 * to "Assigned", bump the employee counter, append audit rows. Any conflict
 * throws → ROLLBACK, nothing is written. Row locks make concurrent baskets
 * over the same laptop impossible.
 */
const { query, withTransaction } = require('./pool');
const { mapRow, mapRows, isUuid } = require('./rowMapper');
const { HttpError } = require('../../utils/httpError');

const MAX_BASKET_SIZE = 100;

async function executeHandover({ employeeId, documentType = 'single', items }, itUser) {
  if (!employeeId || !isUuid(employeeId)) throw HttpError.badRequest('A valid employeeId is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw HttpError.badRequest('The handover basket is empty');
  }
  if (items.length > MAX_BASKET_SIZE) {
    throw HttpError.badRequest(`Basket exceeds the maximum of ${MAX_BASKET_SIZE} assets`);
  }
  if (!['single', 'separate'].includes(documentType)) {
    throw HttpError.badRequest('documentType must be "single" or "separate"');
  }

  const assetIds = items.map((i) => i.assetId);
  if (new Set(assetIds).size !== assetIds.length) {
    throw HttpError.badRequest('Duplicate assets in the basket');
  }
  if (!assetIds.every(isUuid)) throw HttpError.badRequest('Basket contains an invalid assetId');

  return withTransaction(async (t) => {
    // ---- READ + LOCK ------------------------------------------------------
    const empRes = await t.query('SELECT * FROM employees WHERE id = $1 FOR UPDATE', [employeeId]);
    const employee = empRes.rows[0];
    if (!employee) throw HttpError.notFound(`Employee ${employeeId} not found`);
    if (employee.status !== 'Active') {
      throw HttpError.conflict(`Employee ${employee.full_name} is inactive — cannot receive assets`);
    }

    const assetRes = await t.query(
      'SELECT * FROM assets WHERE id = ANY($1::uuid[]) FOR UPDATE',
      [assetIds]
    );
    const byId = new Map(assetRes.rows.map((a) => [a.id, a]));

    // ---- VALIDATE: every basket asset must be In Stock ---------------------
    const conflicts = [];
    for (const item of items) {
      const asset = byId.get(item.assetId);
      if (!asset) {
        conflicts.push({ assetId: item.assetId, reason: 'Asset no longer exists' });
      } else if (asset.status !== 'In Stock') {
        conflicts.push({
          assetId: asset.id,
          assetTag: asset.asset_tag,
          reason: `Asset is "${asset.status}"${asset.current_employee_name ? ` (held by ${asset.current_employee_name})` : ''}`,
        });
      }
    }
    if (conflicts.length > 0) {
      throw HttpError.conflict('Handover rejected: one or more assets are not In Stock', conflicts);
    }

    // ---- WRITE (all-or-nothing) --------------------------------------------
    const receiptItems = items.map((item) => {
      const a = byId.get(item.assetId);
      return {
        assetId: a.id,
        assetTag: a.asset_tag,
        brand: a.brand,
        model: a.model,
        category: a.category,
        serialNumber: a.serial_number,
        macAddress: a.mac_ethernet || a.mac_wifi || null,
        conditionNote: item.conditionNote || '',
      };
    });

    await t.query(
      `UPDATE assets SET status = 'Assigned', current_employee_id = $1,
              current_employee_name = $2, updated_at = now()
       WHERE id = ANY($3::uuid[])`,
      [employee.id, employee.full_name, assetIds]
    );

    for (const item of receiptItems) {
      await t.query(
        `INSERT INTO asset_history
           (asset_id, asset_tag, employee_id, employee_name, action_type, notes, changed_by, changed_by_name)
         VALUES ($1, $2, $3, $4, 'assigned', $5, $6, $7)`,
        [item.assetId, item.assetTag, employee.id, employee.full_name,
         item.conditionNote, itUser.uid, itUser.username || itUser.email]
      );
    }

    await t.query(
      'UPDATE employees SET active_asset_count = active_asset_count + $2 WHERE id = $1',
      [employee.id, receiptItems.length]
    );

    const handoverRes = await t.query(
      `INSERT INTO handovers (employee_id, employee_name, it_user_id, document_type, items)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [employee.id, employee.full_name, itUser.uid, documentType, JSON.stringify(receiptItems)]
    );

    return {
      handoverId: handoverRes.rows[0].id,
      employee: { id: employee.id, fullName: employee.full_name },
      documentType,
      itemCount: receiptItems.length,
      items: receiptItems,
    };
  });
}

async function getHandover(handoverId) {
  if (!isUuid(handoverId)) throw HttpError.notFound(`Handover ${handoverId} not found`);
  const { rows } = await query('SELECT * FROM handovers WHERE id = $1', [handoverId]);
  if (!rows[0]) throw HttpError.notFound(`Handover ${handoverId} not found`);
  return mapRow(rows[0]);
}

async function listHandovers({ employeeId, limit = 50 } = {}) {
  const params = [];
  let where = '';
  if (employeeId) {
    if (!isUuid(employeeId)) return [];
    params.push(employeeId);
    where = 'WHERE employee_id = $1';
  }
  params.push(Math.min(Number(limit) || 50, 200));
  const { rows } = await query(
    `SELECT * FROM handovers ${where} ORDER BY transaction_date DESC LIMIT $${params.length}`,
    params
  );
  return mapRows(rows);
}

module.exports = { executeHandover, getHandover, listHandovers };
