/**
 * Dashboard Aggregate Engine — feeds the Dashboard Overview screen:
 *   - metric cards (total assets, per-status breakdown)
 *   - low-stock consumable alerts (totalStock <= minimumStockAlertLevel)
 *   - licenses expiring within 30 days
 *   - recent handover activity table
 *
 * Uses Firestore server-side count() aggregations where possible so the
 * dashboard stays cheap even with tens of thousands of asset documents.
 */
const { db, Timestamp, COLLECTIONS, ASSET_STATUS } = require('./firebase');

const LICENSE_EXPIRY_WINDOW_DAYS = 30;

async function getAssetCounts() {
  const assets = db.collection(COLLECTIONS.ASSETS);
  const statuses = Object.values(ASSET_STATUS);

  const [total, ...byStatus] = await Promise.all([
    assets.count().get(),
    ...statuses.map((s) => assets.where('status', '==', s).count().get()),
  ]);

  const counts = { total: total.data().count };
  statuses.forEach((s, i) => { counts[s] = byStatus[i].data().count; });
  return counts;
}

/**
 * Firestore cannot compare two document fields in a query, so low-stock
 * detection scans the consumables collection (small by nature — printer
 * toner, cables, adapters — typically < a few hundred docs).
 */
async function getLowStockConsumables() {
  const snap = await db.collection(COLLECTIONS.CONSUMABLES).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => (c.totalStock ?? 0) <= (c.minimumStockAlertLevel ?? 0))
    .sort((a, b) => (a.totalStock ?? 0) - (b.totalStock ?? 0));
}

async function getExpiringLicenses(windowDays = LICENSE_EXPIRY_WINDOW_DAYS) {
  const now = Timestamp.now();
  const horizon = Timestamp.fromMillis(now.toMillis() + windowDays * 24 * 60 * 60 * 1000);

  const snap = await db
    .collection(COLLECTIONS.LICENSES)
    .where('expirationDate', '>=', now)
    .where('expirationDate', '<=', horizon)
    .orderBy('expirationDate', 'asc')
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    const daysLeft = Math.ceil((data.expirationDate.toMillis() - now.toMillis()) / 86400000);
    return { id: d.id, ...data, daysLeft };
  });
}

async function getRecentHandovers(limit = 5) {
  const snap = await db
    .collection(COLLECTIONS.HANDOVERS)
    .orderBy('transactionDate', 'desc')
    .limit(limit)
    .get();

  // Flatten for the "Recent Handover Activity" table: Asset | Employee | Date | Status
  return snap.docs.flatMap((d) => {
    const h = d.data();
    return (h.items || []).map((item) => ({
      handoverId: d.id,
      asset: `${item.brand} ${item.model}`,
      assetTag: item.assetTag,
      employee: h.employeeName,
      date: h.transactionDate,
      status: 'Assigned',
    }));
  }).slice(0, limit);
}

async function getDashboardStats() {
  const [assetCounts, lowStockConsumables, expiringLicenses, recentHandovers] = await Promise.all([
    getAssetCounts(),
    getLowStockConsumables(),
    getExpiringLicenses(),
    getRecentHandovers(),
  ]);

  return {
    assets: {
      total: assetCounts.total,
      inStock: assetCounts[ASSET_STATUS.IN_STOCK] || 0,
      assigned: assetCounts[ASSET_STATUS.ASSIGNED] || 0,
      inRepair: assetCounts[ASSET_STATUS.IN_REPAIR] || 0,
      scrap: assetCounts[ASSET_STATUS.SCRAP] || 0,
    },
    alerts: {
      lowStockConsumables,
      lowStockCount: lowStockConsumables.length,
      expiringLicenses,
      expiringLicenseCount: expiringLicenses.length,
    },
    recentHandovers,
    generatedAt: Timestamp.now(),
  };
}

module.exports = { getDashboardStats };
