/** Asset service (postgres) — Hardware Inventory backend. */
const { query, withTransaction } = require('./pool');
const { mapAsset, mapRows, isUuid } = require('./rowMapper');
const { HttpError } = require('../../utils/httpError');

const STATUSES = ['In Stock', 'Assigned', 'In Repair', 'Scrap'];

const buildQrCodeString = (assetTag) => `ITACPRO|ASSET|${assetTag}`;

function sanitize(body, { partial = false } = {}) {
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
  if (status !== undefined && !STATUSES.includes(status)) {
    throw HttpError.badRequest(`Invalid status "${status}". Must be one of: ${STATUSES.join(', ')}`);
  }

  const data = {};
  // Asset tags are system-assigned and immutable: only honored on create.
  if (!partial && assetTag) data.asset_tag = String(assetTag).trim();
  if (serialNumber !== undefined) data.serial_number = serialNumber.trim();
  if (brand !== undefined) data.brand = brand;
  if (model !== undefined) data.model = model;
  if (category !== undefined) data.category = category;
  if (macEthernet !== undefined) data.mac_ethernet = macEthernet;
  if (macWifi !== undefined) data.mac_wifi = macWifi;
  if (status !== undefined) data.status = status;
  if (warrantyEndDate !== undefined) {
    data.warranty_end_date = warrantyEndDate ? new Date(warrantyEndDate) : null;
  }
  if (body.purchaseDate !== undefined) {
    data.purchase_date = body.purchaseDate ? new Date(body.purchaseDate) : null;
  }
  if (body.lifecycleMonths !== undefined) {
    const m = body.lifecycleMonths === '' || body.lifecycleMonths == null ? null : Number(body.lifecycleMonths);
    if (m !== null && (!Number.isInteger(m) || m < 1 || m > 240)) {
      throw HttpError.badRequest('lifecycleMonths must be an integer between 1 and 240');
    }
    data.lifecycle_months = m;
  }
  if (specs !== undefined) {
    data.specs = JSON.stringify({
      cpu: specs?.cpu || null,
      ram: specs?.ram || null,
      storage: specs?.storage || null,
      os: specs?.os || null,
    });
  }
  if (location !== undefined) data.location = location ? String(location).trim() : null;
  return data;
}

/** Next sequential system tag: IT-1001, IT-1002, … */
async function nextAssetTag() {
  const { rows } = await query(
    `SELECT COALESCE(MAX(substring(asset_tag FROM '^IT-([0-9]+)$')::int), 1000) AS mx
     FROM assets WHERE asset_tag ~ '^IT-[0-9]+$'`
  );
  return 'IT-' + String(rows[0].mx + 1).padStart(4, '0');
}

async function createAsset(body) {
  const data = sanitize(body);
  const autoTag = !data.asset_tag;

  // Retry a couple of times: a concurrent create may grab the same next tag.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (autoTag) data.asset_tag = await nextAssetTag();
    try {
      const { rows } = await query(
        `INSERT INTO assets (asset_tag, serial_number, brand, model, category,
                             mac_ethernet, mac_wifi, specs, status, warranty_end_date, purchase_date, qr_code_string, location, lifecycle_months)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'{}'::jsonb),COALESCE($9,'In Stock'),$10,$11,$12,$13,$14)
         RETURNING id, asset_tag`,
        [
          data.asset_tag, data.serial_number, data.brand, data.model, data.category,
          data.mac_ethernet || null, data.mac_wifi || null, data.specs || null,
          data.status || null, data.warranty_end_date || null, data.purchase_date || null,
          buildQrCodeString(data.asset_tag), data.location || null, data.lifecycle_months ?? null,
        ]
      );
      return { id: rows[0].id, assetTag: rows[0].asset_tag };
    } catch (err) {
      if (err.code === '23505') {
        if (autoTag && attempt < 2) continue; // regenerate and retry
        throw HttpError.conflict(`Asset tag "${data.asset_tag}" is already registered`);
      }
      throw err;
    }
  }
}

async function updateAsset(assetId, body) {
  if (!isUuid(assetId)) throw HttpError.notFound(`Asset ${assetId} not found`);
  const data = sanitize(body, { partial: true });
  if (Object.keys(data).length === 0) throw HttpError.badRequest('No updatable fields provided');

  return withTransaction(async (t) => {
    const { rows } = await t.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [assetId]);
    const current = rows[0];
    if (!current) throw HttpError.notFound(`Asset ${assetId} not found`);

    if (data.status === 'Assigned' && current.status !== 'Assigned') {
      throw HttpError.badRequest('Use POST /api/handovers to assign assets');
    }

    const cols = Object.keys(data);
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    try {
      const updated = await t.query(
        `UPDATE assets SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
        [assetId, ...cols.map((c) => data[c])]
      );
      return mapAsset(updated.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        throw HttpError.conflict(`Asset tag "${data.asset_tag}" is already registered`);
      }
      throw err;
    }
  });
}

async function listAssets({ status, category, employeeId, search, location, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (category) { params.push(category); where.push(`category = $${params.length}`); }
  if (employeeId) {
    if (!isUuid(employeeId)) return { items: [], nextCursor: null };
    params.push(employeeId);
    where.push(`current_employee_id = $${params.length}`);
  }
  if (location) { params.push(location); where.push(`location = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(asset_tag ILIKE $${params.length} OR serial_number ILIKE $${params.length} ` +
      `OR brand ILIKE $${params.length} OR model ILIKE $${params.length} ` +
      `OR mac_ethernet ILIKE $${params.length} OR mac_wifi ILIKE $${params.length})`
    );
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const totalRes = await query(`SELECT COUNT(*)::int AS n FROM assets ${whereSql}`, [...params]);

  params.push(Math.min(Number(limit) || 100, 2000), Number(offset) || 0);
  const { rows } = await query(
    `SELECT * FROM assets ${whereSql}
     ORDER BY asset_tag LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { items: rows.map(mapAsset), total: totalRes.rows[0].n, nextCursor: null };
}

async function getAsset(assetId) {
  if (!isUuid(assetId)) throw HttpError.notFound(`Asset ${assetId} not found`);
  const { rows } = await query('SELECT * FROM assets WHERE id = $1', [assetId]);
  if (!rows[0]) throw HttpError.notFound(`Asset ${assetId} not found`);

  const history = await query(
    'SELECT * FROM asset_history WHERE asset_id = $1 ORDER BY "timestamp" DESC LIMIT 25',
    [assetId]
  );
  return { ...mapAsset(rows[0]), history: mapRows(history.rows) };
}

async function returnAsset(assetId, { conditionNote } = {}, itUser) {
  if (!isUuid(assetId)) throw HttpError.notFound(`Asset ${assetId} not found`);

  return withTransaction(async (t) => {
    const { rows } = await t.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [assetId]);
    const asset = rows[0];
    if (!asset) throw HttpError.notFound(`Asset ${assetId} not found`);
    if (asset.status !== 'Assigned' || !asset.current_employee_id) {
      throw HttpError.conflict(`Asset ${asset.asset_tag} is not currently assigned`);
    }

    await t.query(
      `UPDATE assets SET status = 'In Stock', current_employee_id = NULL,
              current_employee_name = NULL, updated_at = now() WHERE id = $1`,
      [assetId]
    );
    await t.query(
      'UPDATE employees SET active_asset_count = active_asset_count - 1 WHERE id = $1',
      [asset.current_employee_id]
    );
    await t.query(
      `INSERT INTO asset_history
         (asset_id, asset_tag, employee_id, employee_name, action_type, notes, changed_by, changed_by_name)
       VALUES ($1, $2, $3, $4, 'returned', $5, $6, $7)`,
      [assetId, asset.asset_tag, asset.current_employee_id, asset.current_employee_name,
       conditionNote || '', itUser.uid, itUser.username || itUser.email]
    );

    return { id: assetId, assetTag: asset.asset_tag, status: 'In Stock' };
  });
}

module.exports = { createAsset, updateAsset, listAssets, getAsset, returnAsset, nextAssetTag };
