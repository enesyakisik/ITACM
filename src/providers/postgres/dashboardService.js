/** Dashboard Aggregate Engine (postgres) — pure SQL aggregation. */
const { query } = require('./pool');
const { mapRows } = require('./rowMapper');

const LICENSE_EXPIRY_WINDOW_DAYS = 30;

async function getDashboardStats() {
  const [statusCounts, lowStock, expiring, recent] = await Promise.all([
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
    },
    recentHandovers,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getDashboardStats };
