/** Dashboard Aggregate Engine (postgres) — pure SQL aggregation. */
const { query } = require('./pool');
const { mapRows } = require('./rowMapper');
const { DEFAULT_LIFECYCLES } = require('../../utils/defaults');

const LICENSE_EXPIRY_WINDOW_DAYS = 30;

async function getEolAssets() {
  const [lcRes, assetsRes] = await Promise.all([
    query('SELECT lifecycles FROM app_settings WHERE id = 1'),
    query(`SELECT id, asset_tag, brand, model, category, location, current_employee_id, current_employee_name, purchase_date 
           FROM assets WHERE status IN ('In Stock', 'Assigned', 'In Repair')`)
  ]);

  const lc = {
    ...DEFAULT_LIFECYCLES,
    ...(lcRes.rows[0]?.lifecycles || {})
  };

  const now = Date.now();
  const overdue = [];
  const soon = [];

  assetsRes.rows.forEach((row) => {
    const pd = row.purchase_date;
    if (!pd) return;
    const purchaseMs = new Date(pd).getTime();
    if (!purchaseMs) return;

    const months = lc[row.category] || lc.Other || 48;
    const eolMs = purchaseMs + months * 30.4375 * 24 * 3600 * 1000;
    const pct = ((now - purchaseMs) / (eolMs - purchaseMs)) * 100;

    const entry = {
      id: row.id,
      assetTag: row.asset_tag,
      brand: row.brand,
      model: row.model,
      category: row.category,
      location: row.location || null,
      currentEmployee: row.current_employee_id ? { id: row.current_employee_id, fullName: row.current_employee_name } : null,
      purchaseDate: pd.toISOString ? pd.toISOString() : new Date(pd).toISOString(),
      eolDate: new Date(eolMs).toISOString(),
      pct: Math.round(pct),
    };

    if (pct >= 100) overdue.push(entry);
    else if (pct >= 90) soon.push(entry);
  });

  overdue.sort((a, b) => a.eolDate.localeCompare(b.eolDate));
  soon.sort((a, b) => b.pct - a.pct);

  return { overdue, soon };
}

async function getDashboardStats() {
  const [statusCounts, lowStock, expiring, recent, eol, locDist] = await Promise.all([
    query(`SELECT status, COUNT(*)::int AS n FROM assets GROUP BY status`),
    query(
      `SELECT * FROM consumables
       WHERE total_stock <= minimum_stock_alert_level
       ORDER BY total_stock ASC`
    ),
    query(
      `SELECT *, CEIL(EXTRACT(EPOCH FROM (expiration_date - now())) / 86400)::int AS days_left
       FROM licenses
       WHERE expiration_date >= now()
         AND expiration_date <= now() + ($1 || ' days')::interval
       ORDER BY expiration_date ASC`,
      [LICENSE_EXPIRY_WINDOW_DAYS]
    ),
    query(`SELECT * FROM handovers ORDER BY transaction_date DESC LIMIT 5`),
    getEolAssets(),
    query(`SELECT COALESCE(NULLIF(location, ''), 'Unassigned') AS loc, COUNT(*)::int AS n
           FROM assets WHERE status <> 'Scrap' GROUP BY 1 ORDER BY 2 DESC`),
  ]);

  const byStatus = Object.fromEntries(statusCounts.rows.map((r) => [r.status, r.n]));
  const total = statusCounts.rows.reduce((sum, r) => sum + r.n, 0);

  const lowStockConsumables = mapRows(lowStock.rows);
  const expiringLicenses = mapRows(expiring.rows);

  const recentHandovers = recent.rows
    .flatMap((h) =>
      (h.items || []).map((item) => ({
        handoverId: h.id,
        asset: `${item.brand} ${item.model}`,
        assetTag: item.assetTag,
        employee: h.employee_name,
        date: h.transaction_date,
        status: 'Assigned',
      }))
    )
    .slice(0, 5);

  return {
    assets: {
      total,
      inStock: byStatus['In Stock'] || 0,
      assigned: byStatus['Assigned'] || 0,
      inRepair: byStatus['In Repair'] || 0,
      scrap: byStatus['Scrap'] || 0,
    },
    alerts: {
      lowStockConsumables,
      lowStockCount: lowStockConsumables.length,
      expiringLicenses,
      expiringLicenseCount: expiringLicenses.length,
      eolOverdueCount: eol.overdue.length,
      eolSoonCount: eol.soon.length,
      eolOverdue: eol.overdue.slice(0, 5),
    },
    locationDistribution: locDist.rows.map((r) => ({ location: r.loc, count: r.n })),
    recentHandovers,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getDashboardStats };

