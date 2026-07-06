/*
 * Screen views, faithful to the stitch_it_asset_control_pro mockups.
 *
 * XSS policy: innerHTML only ever receives trusted static template markup
 * combined with esc()-encoded dynamic values (see ui.js). No raw user/API
 * input reaches the DOM unescaped.
 */
'use strict';

const Views = {};

function pageHead(title, sub, actionsHtml = '') {
  return `<div class="page-head">
    <div><h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div></div>
    <div class="actions">${actionsHtml}</div>
  </div>`;
}

const CATEGORY_ICONS = {
  Laptop: 'laptop_mac', Desktop: 'desktop_windows', Monitor: 'desktop_windows',
  Phone: 'smartphone', Tablet: 'tablet', Printer: 'print', Network: 'router',
  Peripheral: 'mouse', Other: 'devices_other',
};
const catIcon = (c) => CATEGORY_ICONS[c] || 'devices_other';

/** Lifecycle: centrally-managed months per category, applied to every asset. */
function lifecycleInfo(x) {
  const lc = AppConfig.lifecycles || {};
  const months = lc[x.category] || lc.Other || 48;
  if (!x.purchaseDate) return { months, eol: null, pct: null, overdue: false };
  const start = new Date(x.purchaseDate._seconds ? x.purchaseDate._seconds * 1000 : x.purchaseDate);
  const eol = new Date(start);
  eol.setMonth(eol.getMonth() + months);
  const pct = Math.max(0, Math.round(((Date.now() - start) / (eol - start)) * 100));
  return { months, eol, pct, overdue: Date.now() > eol.getTime() };
}
function lifecycleLabel(x) {
  const l = lifecycleInfo(x);
  if (!l.eol) return `${l.months} months (no purchase date)`;
  return l.overdue
    ? `${l.months} months — EOL ${fmtDate(l.eol)} • OVERDUE, replacement due`
    : `${l.months} months — EOL ${fmtDate(l.eol)} (${Math.min(l.pct, 100)}% elapsed)`;
}

/* =============================== DASHBOARD =============================== */
Views.dashboard = async function (el) {
  const d = await api('/dashboard/stats');
  const a = d.assets;
  const lowest = d.alerts.lowStockConsumables[0];
  const eolOverdue = d.alerts.eolOverdueCount || 0;
  const eolSoon = d.alerts.eolSoonCount || 0;
  const attnItems = (d.alerts.expiringLicenseCount ? 1 : 0) + (lowest ? 1 : 0) + (eolOverdue ? 1 : 0);

  const donut = (() => {
    const dist = (d.locationDistribution || []).slice(0, 4);
    const total = (d.locationDistribution || []).reduce((s, x) => s + x.count, 0) || 1;
    const colors = ['#3525cd', '#2f80ed', '#00b8a9', '#94a3b8'];
    const rings = dist.map((x, i) => {
      const r = 84 - i * 17;
      const c = 2 * Math.PI * r;
      const frac = Math.max(0.02, x.count / total);
      return `<circle cx="100" cy="100" r="${r}" fill="none" stroke="#eceaf5" stroke-width="11"/>
        <circle cx="100" cy="100" r="${r}" fill="none" stroke="${colors[i]}" stroke-width="11"
          stroke-linecap="round" stroke-dasharray="${(frac * c).toFixed(1)} ${c.toFixed(1)}"
          transform="rotate(-90 100 100)"/>`;
    }).join('');
    return `<svg width="196" height="196" viewBox="0 0 200 200" role="img" aria-label="Assets by location">
      ${rings}<text x="100" y="107" text-anchor="middle" font-size="16" font-weight="700" fill="#464555">${total}</text></svg>`;
  })();
  const locColors = ['#3525cd', '#2f80ed', '#00b8a9', '#94a3b8'];

  el.innerHTML = `
    ${pageHead('Dashboard Overview', 'System status, hardware distribution, and operational metrics.', `
      <span class="cell-sub" style="display:flex;align-items:center;gap:6px"><span class="ms ms-sm">sync</span> Last updated: Just now</span>
      <button class="btn btn-outline" data-go="#/reports"><span class="ms">download</span> Export Report</button>`)}

    <div class="dash-grid">
      <div>
        <!-- 2x2 metric cards -->
        <div class="grid grid-2" style="margin-bottom:20px">
          <div class="card metric2 tint-indigo">
            <div class="metric2-head">${iconChip('monitor', 'indigo')}
              <span class="trend-chip up"><span class="ms">trending_up</span> ${a.inStock} in stock</span></div>
            <div class="metric2-label">Total Assets</div>
            <div class="metric2-value">${a.total.toLocaleString()}</div>
          </div>
          <div class="card metric2 tint-blue">
            <div class="metric2-head">${iconChip('handshake', 'blue')}
              <span class="trend-chip up"><span class="ms">trending_up</span> assigned</span></div>
            <div class="metric2-label">Active Handovers</div>
            <div class="metric2-value">${a.assigned.toLocaleString()}</div>
          </div>
          <div class="card metric2 tint-amber">
            <div class="metric2-head">${iconChip('build', 'amber')}
              <span class="trend-chip flat"><span class="ms">remove</span> ${a.inRepair ? 'In service' : 'None open'}</span></div>
            <div class="metric2-label">Items in Repair</div>
            <div class="metric2-value">${a.inRepair.toLocaleString()}</div>
          </div>
          <div class="card metric2 tint-rose">
            <div class="metric2-head">${iconChip('inventory_2', 'rose')}
              <span class="trend-chip ${d.alerts.lowStockCount ? 'down' : 'flat'}">
                <span class="ms">${d.alerts.lowStockCount ? 'trending_down' : 'remove'}</span>
                ${d.alerts.lowStockCount ? 'Needs attention' : 'All healthy'}</span></div>
            <div class="metric2-label">Low Stock Items</div>
            <div class="metric2-value">${d.alerts.lowStockCount}</div>
          </div>
        </div>

        <!-- Recent handover activity -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-head" style="align-items:flex-start">
            <div>
              <h3 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--on-surface)">Recent Handover Activity</h3>
              <div class="cell-sub" style="margin-top:2px">Latest asset assignments and returns.</div>
            </div>
            <button class="btn btn-outline btn-sm" data-go="#/handover">View All</button>
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Asset</th><th>Employee</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              ${d.recentHandovers.length === 0 ? '<tr><td colspan="4" class="table-empty">No handovers yet.</td></tr>' :
                d.recentHandovers.map((h) => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:12px">
                    <span class="icon-chip" style="background:var(--surface-container);color:var(--on-surface-variant)"><span class="ms">laptop_mac</span></span>
                    <div><div class="cell-title">${esc(h.asset)}</div><div class="cell-sub mono">${esc(h.assetTag)}</div></div>
                  </div></td>
                  <td><div style="display:flex;align-items:center;gap:8px">
                    <span class="avatar" style="width:28px;height:28px;font-size:10px">${esc(initials(h.employee))}</span>
                    ${esc(h.employee)}</div></td>
                  <td>${fmtDate(h.date)}</td>
                  <td>${badge('Completed')}</td>
                </tr>`).join('')}
            </tbody>
          </table></div>
        </div>

        <!-- Lifecycle EOL devices -->
        <div class="card">
          <div class="card-head" style="align-items:flex-start">
            <div>
              <h3 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--on-surface)">Lifecycle EOL Devices</h3>
              <div class="cell-sub" style="margin-top:2px">${eolOverdue} overdue • ${eolSoon} approaching end of lifecycle.</div>
            </div>
            <button class="btn btn-outline btn-sm" data-go="#/assets?lifecycle=overdue">Review</button>
          </div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Asset</th><th>Location</th><th>Holder</th><th>Purchased</th><th>EOL Date</th></tr></thead>
            <tbody>
              ${(d.alerts.eolOverdue || []).length === 0 ? '<tr><td colspan="5" class="table-empty">No devices past their lifecycle. 🎉</td></tr>' :
                d.alerts.eolOverdue.map((x) => `
                <tr class="asset-row" data-open-asset="${esc(x.id)}" style="cursor:pointer">
                  <td><div class="cell-title">${esc(x.brand)} ${esc(x.model)}</div><div class="cell-sub mono">${esc(x.assetTag)}</div></td>
                  <td class="cell-sub">${esc(x.location || '—')}</td>
                  <td>${x.currentEmployee ? esc(x.currentEmployee.fullName) : '<span class="cell-sub">In stock</span>'}</td>
                  <td>${fmtDate(x.purchaseDate)}</td>
                  <td><span class="pill pill-rose">${fmtDate(x.eolDate)}</span></td>
                </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>

      <div>
        <!-- Attention Required -->
        <div class="card attn-card" style="margin-bottom:20px">
          <div class="attn-head">
            <div><h3>Attention Required</h3>
              <div class="cell-sub">${attnItems} item${attnItems === 1 ? '' : 's'} need your review.</div></div>
            <span class="attn-count">${attnItems}</span>
          </div>
          ${attnItems === 0 ? '<div class="table-empty">All clear. 🎉</div>' : ''}
          ${d.alerts.expiringLicenseCount ? `
          <div class="attn-item amber">
            ${iconChip('vpn_key', 'amber')}
            <div style="flex:1"><strong>License Expirations</strong>
              <span class="cell-sub">${d.alerts.expiringLicenseCount} software license${d.alerts.expiringLicenseCount > 1 ? 's' : ''} expiring in 30 days.</span>
              <div style="text-align:right"><button class="attn-link" data-go="#/licenses">Review <span class="ms ms-sm">arrow_forward</span></button></div>
            </div>
          </div>` : ''}
          ${lowest ? `
          <div class="attn-item rose">
            ${iconChip('inventory_2', 'rose')}
            <div style="flex:1"><strong>Low Hardware Stock</strong>
              <span class="cell-sub">${esc(lowest.itemName)} stock is critically low (${lowest.totalStock} remaining).</span>
              <div style="text-align:right"><button class="attn-link" data-go="#/consumables">Reorder <span class="ms ms-sm">arrow_forward</span></button></div>
            </div>
          </div>` : ''}
          ${eolOverdue ? `
          <div class="attn-item rose">
            ${iconChip('history_toggle_off', 'rose')}
            <div style="flex:1"><strong>Lifecycle EOL</strong>
              <span class="cell-sub">${eolOverdue} device${eolOverdue > 1 ? 's' : ''} past their lifecycle — replacement due.</span>
              <div style="text-align:right"><button class="attn-link" data-go="#/assets?lifecycle=overdue">Review <span class="ms ms-sm">arrow_forward</span></button></div>
            </div>
          </div>` : ''}
        </div>

        <!-- Asset distribution by location (click for detail popup) -->
        <div class="card" id="dist-card" style="margin-bottom:20px;cursor:pointer" title="Click for detailed breakdown">
          <div class="card-head" style="border-bottom:none;padding-bottom:0;align-items:flex-start">
            <div><h3 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--on-surface)">Asset Distribution</h3>
              <div class="cell-sub" style="margin-top:2px">By primary location — click for details</div></div>
            <span class="ms" style="color:var(--outline)">open_in_full</span>
          </div>
          <div class="donut-wrap">${donut}</div>
          <div style="padding-bottom:12px">
            ${(d.locationDistribution || []).slice(0, 4).map((x, i) => `
            <div class="loc-legend">
              <span class="dot" style="background:${locColors[i]}"></span>
              ${esc(x.location)}
              <strong>${x.count}</strong>
            </div>`).join('')}
          </div>
        </div>

        <!-- Expiring licenses -->
        <div class="card">
          <div class="card-head"><h3>Expiring Licenses</h3></div>
          ${d.alerts.expiringLicenses.length === 0 ? '<div class="table-empty">No licenses expiring soon.</div>' :
            d.alerts.expiringLicenses.slice(0, 4).map((l) => `
            <div class="exp-item">
              ${iconChip('vpn_key', l.daysLeft <= 14 ? 'amber' : 'indigo')}
              <div>
                <strong>${esc(l.softwareName)}</strong>
                <span class="cell-sub">${l.totalSeats} Seats${l.vendor ? ' • ' + esc(l.vendor) : ''}</span>
                <div class="exp-days ${l.daysLeft <= 7 ? 'urgent' : ''}">Exp. in ${l.daysLeft} Days</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  bindView(el, (e) => {
    const row = e.target.closest('tr[data-open-asset]');
    if (row) { showAssetDetail(row.dataset.openAsset); return; }
    if (e.target.closest('#dist-card')) { showLocationBreakdown(); return; }
    const b = e.target.closest('[data-go]');
    if (b) location.hash = b.dataset.go;
  });
};

/* Detailed asset-distribution popup: per-location totals, status split,
   category mix and value share, with click-through to filtered inventory. */
async function showLocationBreakdown() {
  const { items } = await api('/assets?limit=2000');
  const locs = new Map();
  for (const x of items) {
    const key = x.location || 'Unassigned';
    if (!locs.has(key)) locs.set(key, { total: 0, statuses: {}, categories: {} });
    const L = locs.get(key);
    L.total++;
    L.statuses[x.status] = (L.statuses[x.status] || 0) + 1;
    L.categories[x.category] = (L.categories[x.category] || 0) + 1;
  }
  const rows = [...locs.entries()].sort((a, b) => b[1].total - a[1].total);
  const grand = items.length || 1;
  const SC = { 'Assigned': '#3525cd', 'In Stock': '#c3c0ff', 'In Repair': '#f59e0b', 'Scrap': '#ffb4ab' };

  openModal({
    title: `Asset Distribution by Location (${items.length} assets)`,
    wide: true,
    body: rows.map(([name, L]) => {
      const topCats = Object.entries(L.categories).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([c, n]) => `${c} ${n}`).join(' • ');
      return `
      <div style="border:1px solid var(--outline-variant);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span class="ms" style="color:var(--on-surface-variant)">location_on</span>
          <strong style="font-size:14.5px">${esc(name)}</strong>
          <span class="cell-sub">${Math.round((L.total / grand) * 100)}% of fleet</span>
          <span style="margin-left:auto;display:flex;align-items:center;gap:8px">
            <span class="badge-count">${L.total}</span>
            <button class="btn btn-outline btn-sm" data-loc-view="${esc(name === 'Unassigned' ? '' : name)}">View assets</button>
          </span>
        </div>
        <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--surface-container);margin-bottom:8px">
          ${Object.entries(SC).map(([st, color]) =>
            L.statuses[st] ? `<span style="width:${(L.statuses[st] / L.total) * 100}%;background:${color}" title="${st}: ${L.statuses[st]}"></span>` : '').join('')}
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap" class="cell-sub">
          ${Object.entries(SC).map(([st, color]) =>
            L.statuses[st] ? `<span style="display:flex;align-items:center;gap:5px">
              <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>${st}: <strong>${L.statuses[st]}</strong></span>` : '').join('')}
          <span style="margin-left:auto">${esc(topCats)}</span>
        </div>
      </div>`;
    }).join(''),
    foot: '<button class="btn btn-outline" data-close>Close</button>',
    onMount(overlay) {
      overlay.querySelectorAll('[data-loc-view]').forEach((b) => b.addEventListener('click', () => {
        closeModal();
        location.hash = '#/assets' + (b.dataset.locView ? '?location=' + encodeURIComponent(b.dataset.locView) : '');
      }));
    },
  });
}

/* ================================ ASSETS ================================= */
Views.assets = async function (el, params = {}) {
  const canEdit = Auth.can('canManageAssets');
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.category) q.set('category', params.category);
  if (params.location) q.set('location', params.location);
  if (params.search) q.set('search', params.search);
  q.set('limit', '2000');
  let [{ items, total }, stats] = await Promise.all([
    api('/assets?' + q.toString()),
    api('/dashboard/stats'),
  ]);
  const a = stats.assets;

  // Lifecycle filter is computed client-side from purchase date + settings.
  if (params.lifecycle === 'overdue') {
    items = items.filter((x) => lifecycleInfo(x).overdue && x.status !== 'Scrap');
    total = items.length;
  } else if (params.lifecycle === 'soon') {
    items = items.filter((x) => { const l = lifecycleInfo(x); return !l.overdue && l.pct != null && l.pct >= 90 && x.status !== 'Scrap'; });
    total = items.length;
  }

  // Client-side paging over the (already filtered) result set.
  const PAGE_SIZE = 50;
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const CATS = ['Laptop', 'Desktop', 'Monitor', 'Phone', 'Tablet', 'Printer', 'Network', 'Peripheral', 'Other'];

  const chips = [];
  if (params.status) chips.push({ key: 'status', label: `Status: ${params.status}` });
  if (params.category) chips.push({ key: 'category', label: `Category: ${params.category}` });
  if (params.location) chips.push({ key: 'location', label: `Location: ${params.location}` });
  if (params.lifecycle) chips.push({ key: 'lifecycle', label: `Lifecycle: ${params.lifecycle === 'overdue' ? 'Past EOL' : 'EOL soon'}` });
  if (params.search) chips.push({ key: 'search', label: `Search: ${params.search}` });

  el.innerHTML = `
    ${pageHead('Hardware Inventory', 'Manage physical devices, laptops, and networking gear.', canEdit ? `
      <button class="btn btn-outline" id="asset-export"><span class="ms">download</span> Export</button>
      <button class="btn btn-primary" id="asset-new"><span class="ms">add</span> Add New Asset</button>` : '')}

    <div class="grid grid-4" style="margin-bottom:20px">
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Total Hardware</h3>${iconChip('devices', 'indigo')}</div>
        <div class="metric-value">${a.total.toLocaleString()}</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Available Stock</h3>${iconChip('inventory_2', 'emerald')}</div>
        <div class="metric-value">${a.inStock.toLocaleString()}</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">In Repair</h3>${iconChip('build', 'amber')}</div>
        <div class="metric-value">${a.inRepair.toLocaleString()}
          ${a.inRepair ? '<span class="metric-trend trend-down" style="font-size:11px;display:inline;margin-left:6px">Action Needed</span>' : ''}</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Assigned</h3>${iconChip('handshake', 'blue')}</div>
        <div class="metric-value">${a.assigned.toLocaleString()}</div>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box"><span class="ms">search</span>
        <input type="search" id="asset-search" placeholder="Search tag, serial, brand, MAC…" value="${esc(params.search || '')}"></div>
      <select id="asset-status">
        <option value="">All statuses</option>
        ${['In Stock', 'Assigned', 'In Repair', 'Scrap'].map((s) =>
          `<option ${params.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <select id="asset-category">
        <option value="">All categories</option>
        ${CATS.map((c) => `<option ${params.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select id="asset-location">
        <option value="">All locations</option>
        ${(AppConfig.locations || []).map((l) => `<option ${params.location === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
    </div>
    ${chips.length ? `<div class="filter-chips"><strong>Active Filters:</strong>
      ${chips.map((c) => `<span class="chip">${esc(c.label)} <button data-clear="${c.key}"><span class="ms">close</span></button></span>`).join('')}
      <a href="#" id="clear-all">Clear All</a></div>` : ''}

    <div id="bulk-bar-slot"></div>

    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr>
        <th style="width:34px"><input type="checkbox" id="sel-all" style="width:15px;height:15px" ${!canEdit ? 'disabled' : ''}></th>
        <th style="width:44px">QR</th><th>Asset ID</th><th>Brand &amp; Model</th><th>Serial No</th>
        <th>MAC Address</th><th>Location</th><th>Status</th><th style="text-align:right">Actions</th>
      </tr></thead>
      <tbody>
        ${pageItems.length === 0 ? '<tr><td colspan="9" class="table-empty">No assets found.</td></tr>' :
          pageItems.map((x) => {
            const specsBits = x.specs ? [x.specs.cpu, x.specs.ram].filter(Boolean).join(', ') : '';
            return `
            <tr class="asset-row ${x.status === 'Scrap' ? 'row-scrap' : ''}" data-open-asset="${esc(x.id)}" style="cursor:pointer">
              <td><input type="checkbox" data-sel="${esc(x.id)}" style="width:15px;height:15px" ${!canEdit ? 'disabled' : ''}></td>
              <td class="qr-cell"><button class="icon-btn" data-qr="${esc(x.id)}" title="Show QR code" style="width:30px;height:30px"><span class="ms">qr_code_2</span></button></td>
              <td class="mono">${esc(x.assetTag)}</td>
              <td><div class="cell-title">${esc(x.brand)} ${esc(x.model)}</div>
                <div class="cell-sub">${esc(x.category)}${specsBits ? ' • ' + esc(specsBits) : ''}</div></td>
              <td class="mono">${esc(x.serialNumber)}</td>
              <td class="mono">${x.macEthernet || x.macWifi ? esc(x.macEthernet || x.macWifi) : '<span class="cell-sub">N/A</span>'}</td>
              <td class="cell-sub">${esc(x.location || '—')}</td>
              <td>${badge(x.status)}${(() => { const l = lifecycleInfo(x);
                return l.overdue && x.status !== 'Scrap' ? ' <span class="pill pill-rose" title="Past its lifecycle — replacement due">EOL</span>'
                  : (l.pct != null && l.pct >= 90 && x.status !== 'Scrap' ? ' <span class="pill pill-amber" title="Approaching end of lifecycle">EOL soon</span>' : ''); })()}</td>
              <td class="actions">
                <button class="btn btn-outline btn-sm" data-view="${esc(x.id)}">View</button>
                ${canEdit ? `
                  <button class="btn btn-outline btn-sm" data-edit="${esc(x.id)}">Edit</button>
                  ${x.status === 'Assigned' ? `<button class="btn btn-outline btn-sm" data-return="${esc(x.id)}">Return</button>` : ''}
                  ${x.status === 'In Stock' || x.status === 'Assigned' ? `<button class="btn btn-outline btn-sm" data-repair="${esc(x.id)}">Repair</button>` : ''}` : ''}
              </td>
            </tr>`;
          }).join('')}
      </tbody>
    </table></div>
    <div class="table-foot">
      Showing ${items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, items.length)}
      of ${total != null ? total : items.length} assets
      <span class="spacer"></span>
      <button class="btn btn-outline btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <span style="padding:0 6px">Page ${page} / ${pages}</span>
      <button class="btn btn-outline btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next ›</button>
    </div>
    </div>`;

  /* ---- multi-select bulk actions ---- */
  const selected = new Set();
  function renderBulkBar() {
    const slot = $('#bulk-bar-slot', el);
    if (selected.size === 0) { slot.innerHTML = ''; return; }
    slot.innerHTML = `
      <div class="bulk-bar">
        <span class="ms" style="color:var(--indigo-700)">check_box</span>
        <strong>${selected.size} selected</strong>
        <span class="spacer"></span>
        <button class="btn btn-outline btn-sm" id="bulk-return"><span class="ms">undo</span> Return to Stock</button>
        <button class="btn btn-outline btn-sm" id="bulk-repair"><span class="ms">build</span> Send to Repair</button>
        <button class="btn btn-danger btn-sm" id="bulk-scrap"><span class="ms">delete</span> Scrap</button>
        <button class="btn btn-outline btn-sm" id="bulk-clear">Clear</button>
      </div>`;

    const pick = () => items.filter((x) => selected.has(x.id));

    $('#bulk-clear', slot).addEventListener('click', () => {
      selected.clear();
      el.querySelectorAll('input[data-sel]').forEach((c) => { c.checked = false; });
      $('#sel-all', el).checked = false;
      renderBulkBar();
    });

    $('#bulk-return', slot).addEventListener('click', async () => {
      const targets = pick().filter((x) => x.status === 'Assigned');
      if (!targets.length) return toast('None of the selected assets are Assigned', 'error');
      let ok = 0;
      for (const x of targets) {
        try { await api(`/assets/${x.id}/return`, { method: 'POST', body: { conditionNote: 'Bulk return' } }); ok++; }
        catch (err) { toast(`${x.assetTag}: ${err.message}`, 'error'); }
      }
      toast(`${ok}/${targets.length} asset(s) returned to stock`, 'success');
      rerender({});
    });

    $('#bulk-repair', slot).addEventListener('click', () => {
      const targets = pick().filter((x) => x.status === 'In Stock' || x.status === 'Assigned');
      if (!targets.length) return toast('Selected assets cannot be sent to repair', 'error');
      formModal({
        title: `Send ${targets.length} asset(s) to repair`,
        fields: [
          { name: 'serviceCompany', label: 'Service company *', required: true },
          { name: 'cost', label: 'Estimated cost (per asset)', type: 'number', step: '0.01' },
          { name: 'issueDescription', label: 'Issue description *', type: 'textarea', required: true, full: true },
        ],
        submitLabel: 'Send all to repair',
        async onSubmit(d) {
          let ok = 0;
          for (const x of targets) {
            try { await api('/maintenance', { method: 'POST', body: { ...d, assetId: x.id } }); ok++; }
            catch (err) { toast(`${x.assetTag}: ${err.message}`, 'error'); }
          }
          toast(`${ok}/${targets.length} asset(s) sent to repair`, 'success');
          rerender({});
        },
      });
    });

    $('#bulk-scrap', slot).addEventListener('click', () => {
      const targets = pick().filter((x) => x.status === 'In Stock' || x.status === 'In Repair');
      const skipped = selected.size - targets.length;
      if (!targets.length) return toast('Only In Stock / In Repair assets can be scrapped (return assigned ones first)', 'error');
      confirmModal(
        `Scrap ${targets.length} asset(s)?${skipped ? ` (${skipped} assigned/scrapped skipped)` : ''} This marks them as end-of-life.`,
        async () => {
          let ok = 0;
          for (const x of targets) {
            try { await api(`/assets/${x.id}`, { method: 'PUT', body: { status: 'Scrap' } }); ok++; }
            catch (err) { toast(`${x.assetTag}: ${err.message}`, 'error'); }
          }
          toast(`${ok}/${targets.length} asset(s) scrapped`, 'success');
          rerender({});
        }
      );
    });
  }

  const selAll = $('#sel-all', el);
  if (selAll) selAll.addEventListener('change', () => {
    el.querySelectorAll('input[data-sel]').forEach((c) => {
      c.checked = selAll.checked;
      if (selAll.checked) selected.add(c.dataset.sel); else selected.delete(c.dataset.sel);
    });
    renderBulkBar();
  });
  el.querySelectorAll('input[data-sel]').forEach((c) => c.addEventListener('change', () => {
    if (c.checked) selected.add(c.dataset.sel); else selected.delete(c.dataset.sel);
    renderBulkBar();
  }));

  const rerender = (p) => Views.assets(el, { ...params, ...p });
  $('#asset-search', el).addEventListener('change', (e) => rerender({ search: e.target.value, page: 1 }));
  $('#asset-status', el).addEventListener('change', (e) => rerender({ status: e.target.value, page: 1 }));
  $('#asset-category', el).addEventListener('change', (e) => rerender({ category: e.target.value, page: 1 }));
  $('#asset-location', el).addEventListener('change', (e) => rerender({ location: e.target.value, page: 1 }));
  if (canEdit) {
    $('#asset-new', el).addEventListener('click', () => assetForm(null, () => rerender({})));
    $('#asset-export', el).addEventListener('click', () => exportCsv(items));
  }
  const clearAll = $('#clear-all', el);
  if (clearAll) clearAll.addEventListener('click', (e) => { e.preventDefault(); rerender({ status: '', category: '', location: '', lifecycle: '', search: '', page: 1 }); });

  bindView(el, async (e) => {
    if (e.target.closest('input')) return; // checkboxes have their own handlers
    const byId = (id) => items.find((x) => x.id === id);

    const b = e.target.closest('button');
    if (!b) {
      // Click anywhere on the row → open the asset detail screen.
      const row = e.target.closest('tr.asset-row');
      if (row) showAssetDetail(row.dataset.openAsset, () => rerender({}));
      return;
    }
    if (b.dataset.qr) { showQrModal(byId(b.dataset.qr)); return; }
    if (b.dataset.page) { rerender({ page: Number(b.dataset.page) }); return; }
    if (b.dataset.clear) rerender({ [b.dataset.clear]: '', page: 1 });
    if (b.dataset.view) showAssetDetail(b.dataset.view, () => rerender({}));
    if (b.dataset.edit) assetForm(byId(b.dataset.edit), () => rerender({}));
    if (b.dataset.return) {
      const x = byId(b.dataset.return);
      formModal({
        title: `Return ${x.assetTag} to stock`,
        fields: [{ name: 'conditionNote', label: 'Condition note', type: 'textarea', full: true }],
        submitLabel: 'Return to stock',
        async onSubmit(d) {
          await api(`/assets/${x.id}/return`, { method: 'POST', body: d });
          toast(`${x.assetTag} returned to stock`, 'success');
          rerender({});
        },
      });
    }
    if (b.dataset.repair) {
      const x = byId(b.dataset.repair);
      formModal({
        title: `Send ${x.assetTag} to repair`,
        fields: [
          { name: 'serviceCompany', label: 'Service company', required: true },
          { name: 'cost', label: 'Estimated cost', type: 'number', step: '0.01' },
          { name: 'issueDescription', label: 'Issue description', type: 'textarea', required: true, full: true },
        ],
        submitLabel: 'Send to repair',
        async onSubmit(d) {
          await api('/maintenance', { method: 'POST', body: { ...d, assetId: x.id } });
          toast(`${x.assetTag} sent to repair`, 'success');
          rerender({});
        },
      });
    }
  });
};

function exportCsv(items) {
  const head = ['assetTag', 'brand', 'model', 'category', 'serialNumber', 'macEthernet', 'macWifi', 'status', 'employee'];
  const rows = items.map((x) => [
    x.assetTag, x.brand, x.model, x.category, x.serialNumber,
    x.macEthernet || '', x.macWifi || '', x.status, x.currentEmployee ? x.currentEmployee.fullName : '',
  ]);
  const csvEsc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = [head, ...rows].map((r) => r.map(csvEsc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'hardware-inventory.csv';
  a.click();
}

async function assetForm(asset, done) {
  const s = (asset && asset.specs) || {};
  const CATS = ['Laptop', 'Desktop', 'Monitor', 'Phone', 'Tablet', 'Printer', 'Network', 'Peripheral', 'Other'];
  const catalog = await api('/catalog').catch(() => []);
  const state = {
    category: (asset && asset.category) || 'Laptop',
    brand: (asset && asset.brand) || '',
    model: (asset && asset.model) || '',
  };
  const OTHER = '__other__';
  const brandsFor = (cat) => [...new Set(catalog.filter((c) => c.category === cat).map((c) => c.brand))].sort();
  const modelsFor = (cat, brand) => catalog.filter((c) => c.category === cat && c.brand === brand).map((c) => c.model).sort();

  openModal({
    title: asset ? `Edit ${asset.assetTag}` : 'Add New Asset',
    wide: true,
    body: `
      <form id="af"><div class="form-grid">
        <div class="form-field"><label>Asset tag <span class="ob-hint">(system-assigned, sequential)</span></label>
          <input value="${asset ? esc(asset.assetTag) : 'Auto — next IT-xxxx'}" disabled></div>
        <div class="form-field"><label>Serial number *</label>
          <input name="serialNumber" required value="${esc((asset && asset.serialNumber) || '')}"></div>
        <div class="form-field"><label>Category *</label>
          <select id="af-cat">${CATS.map((c) => `<option ${state.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="form-field"><label>Purchase date</label>
          <input type="date" name="purchaseDate" value="${asset && asset.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : ''}"></div>
        <div class="form-field"><label>Location</label>
          <select name="location">
            <option value="">— No location —</option>
            ${(AppConfig.locations || []).map((l) => {
              const sel = asset ? asset.location === l : AppConfig.defaultLocation === l;
              return `<option ${sel ? 'selected' : ''}>${esc(l)}</option>`;
            }).join('')}
          </select></div>
        <div class="form-field"></div>
        <div class="form-field"><label>Brand * <span class="ob-hint">(from Product Catalog)</span></label>
          <div id="af-brand-slot"></div></div>
        <div class="form-field"><label>Model *</label>
          <div id="af-model-slot"></div></div>
        <div class="form-field" data-f="macEthernet"><label>MAC (Ethernet)</label>
          <input name="macEthernet" placeholder="AA:BB:CC:DD:EE:FF" value="${esc((asset && asset.macEthernet) || '')}"></div>
        <div class="form-field" data-f="macWifi"><label>MAC (Wi-Fi)</label>
          <input name="macWifi" placeholder="AA:BB:CC:DD:EE:FF" value="${esc((asset && asset.macWifi) || '')}"></div>
        ${['cpu', 'ram', 'storage'].map((k) => {
          const opts = (AppConfig.specOptions || {})[k] || [];
          const cur = s[k] || '';
          const known = !cur || opts.includes(cur);
          return `<div class="form-field" data-f="${k}"><label>${k.toUpperCase()} * <span class="ob-hint">(list managed in Product Catalog)</span></label>
            <select name="${k}">
              <option value="">Select ${k.toUpperCase()}…</option>
              ${known ? '' : `<option selected>${esc(cur)}</option>`}
              ${opts.map((o) => `<option ${cur === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            </select></div>`;
        }).join('')}
        <div class="form-field" data-f="os"><label>OS</label><input name="os" value="${esc(s.os || '')}"></div>
      </div><div id="af-error"></div></form>`,
    foot: `<button class="btn btn-outline" data-close>Cancel</button>
           <button class="btn btn-primary" type="submit" form="af">Save</button>`,
    onMount(overlay) {
      // Category-dependent fields: only show what makes sense for the device type.
      const FIELD_RULES = {
        Laptop: ['macEthernet', 'macWifi', 'cpu', 'ram', 'storage', 'os'],
        Desktop: ['macEthernet', 'macWifi', 'cpu', 'ram', 'storage', 'os'],
        Tablet: ['macWifi', 'storage', 'os'],
        Phone: ['macWifi', 'storage', 'os'],
        Monitor: [],
        Printer: ['macEthernet', 'macWifi'],
        Network: ['macEthernet'],
        Peripheral: [],
        Other: ['macEthernet', 'macWifi', 'cpu', 'ram', 'storage', 'os'],
      };
      const allowedFields = () => FIELD_RULES[state.category] || FIELD_RULES.Other;
      function applyFieldRules() {
        const allowed = allowedFields();
        overlay.querySelectorAll('[data-f]').forEach((w) =>
          w.classList.toggle('hidden', !allowed.includes(w.dataset.f)));
      }

      // Show the real next tag (server-assigned at save time).
      if (!asset) {
        api('/assets/next-tag').then((r) => {
          const inp = overlay.querySelector('input[disabled]');
          if (inp) inp.value = r.nextTag;
        }).catch(() => {});
      }

      function renderModel() {
        const models = modelsFor(state.category, state.brand);
        const mSlot = $('#af-model-slot', overlay);
        if (models.length === 0) {
          mSlot.innerHTML = `<input id="af-model-text" placeholder="Model" value="${esc(state.model)}">`;
        } else {
          const known = models.includes(state.model);
          mSlot.innerHTML = `
            <select id="af-model">
              <option value="">Select model…</option>
              ${models.map((m) => `<option ${state.model === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}
              <option value="${OTHER}" ${state.model && !known ? 'selected' : ''}>Other (type manually)…</option>
            </select>
            <input id="af-model-text" class="${state.model && !known ? '' : 'hidden'}" style="margin-top:6px" placeholder="Model" value="${known ? '' : esc(state.model)}">`;
          $('#af-model', overlay).addEventListener('change', (e) => {
            const v = e.target.value;
            state.model = v === OTHER ? '' : v;
            $('#af-model-text', overlay).classList.toggle('hidden', v !== OTHER);
          });
        }
        const mt = $('#af-model-text', overlay);
        if (mt) mt.addEventListener('input', (e) => { state.model = e.target.value; });
      }

      function renderPickers() {
        const brands = brandsFor(state.category);
        const bSlot = $('#af-brand-slot', overlay);
        if (brands.length === 0) {
          bSlot.innerHTML = `<input id="af-brand-text" placeholder="Brand" value="${esc(state.brand)}">`;
        } else {
          const known = brands.includes(state.brand);
          bSlot.innerHTML = `
            <select id="af-brand">
              <option value="">Select brand…</option>
              ${brands.map((b) => `<option ${state.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
              <option value="${OTHER}" ${state.brand && !known ? 'selected' : ''}>Other (type manually)…</option>
            </select>
            <input id="af-brand-text" class="${state.brand && !known ? '' : 'hidden'}" style="margin-top:6px" placeholder="Brand" value="${known ? '' : esc(state.brand)}">`;
          $('#af-brand', overlay).addEventListener('change', (e) => {
            const v = e.target.value;
            state.brand = v === OTHER ? '' : v;
            $('#af-brand-text', overlay).classList.toggle('hidden', v !== OTHER);
            state.model = '';
            renderModel();
          });
        }
        const bt = $('#af-brand-text', overlay);
        if (bt) bt.addEventListener('input', (e) => { state.brand = e.target.value; renderModel(); });
        renderModel();
      }

      $('#af-cat', overlay).addEventListener('change', (e) => {
        state.category = e.target.value;
        state.brand = ''; state.model = '';
        renderPickers();
        applyFieldRules();
      });
      renderPickers();
      applyFieldRules();

      $('#af', overlay).addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const allowed = allowedFields();
        const take = (name) => (allowed.includes(name) ? f[name].value || null : null);
        const body = {
          serialNumber: f.serialNumber.value.trim(),
          brand: state.brand.trim(),
          model: state.model.trim(),
          category: state.category,
          purchaseDate: f.purchaseDate.value || null,
          location: f.location.value || null,
          macEthernet: take('macEthernet'),
          macWifi: take('macWifi'),
          specs: { cpu: take('cpu'), ram: take('ram'), storage: take('storage'), os: take('os') },
        };
        try {
          if (!body.brand || !body.model) {
            throw new Error('Brand and model are required — pick from the catalog or choose "Other" and type them');
          }
          // CPU / RAM / Storage are mandatory whenever the category uses them
          // (reports filter on these fields).
          for (const k of ['cpu', 'ram', 'storage']) {
            if (allowed.includes(k) && !body.specs[k]) {
              throw new Error(`${k.toUpperCase()} is required for ${state.category} — pick one from the list (manage lists in Product Catalog)`);
            }
          }
          let created;
          if (asset) await api(`/assets/${asset.id}`, { method: 'PUT', body });
          else created = await api('/assets', { method: 'POST', body });
          toast(asset ? 'Asset updated' : `Asset created — tag ${created.assetTag} assigned automatically`, 'success');
          closeModal();
          done();
        } catch (err) {
          $('#af-error', overlay).innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
        }
      });
    },
  });
}

/* QR code modal — renders a scannable QR for the asset's qrCodeString. */
async function showQrModal(asset) {
  if (!asset) return;
  openModal({
    title: `QR — ${asset.assetTag}`,
    body: `
      <div style="text-align:center">
        <div id="qr-canvas-wrap" style="display:inline-block;background:#fff;padding:12px;border:1px solid var(--outline-variant);border-radius:8px">
          <div class="cell-sub">Generating…</div>
        </div>
        <div class="mono" style="margin-top:10px">${esc(asset.qrCodeString || '')}</div>
        <div class="cell-sub" style="margin-top:4px">${esc(asset.brand)} ${esc(asset.model)} · ${esc(asset.serialNumber)}</div>
      </div>`,
    foot: `<button class="btn btn-outline" data-close>Close</button>
           <button class="btn btn-primary" id="qr-download" disabled><span class="ms">download</span> Download PNG</button>`,
    async onMount(overlay) {
      const wrap = $('#qr-canvas-wrap', overlay);
      try {
        // Generated server-side — no external library, works fully offline.
        const { dataUrl } = await api(`/assets/${asset.id}/qr`);
        wrap.innerHTML = `<img src="${esc(dataUrl)}" width="220" height="220" alt="QR">`;
        const dl = $('#qr-download', overlay);
        dl.disabled = false;
        dl.addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `${asset.assetTag}-qr.png`;
          a.click();
        });
      } catch (err) {
        wrap.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      }
    },
  });
}

async function showAssetDetail(id, onChange) {
  const x = await api(`/assets/${id}`);
  const s = x.specs || {};
  const canEdit = Auth.can('canManageAssets');
  const refresh = () => { if (onChange) onChange(); };

  openModal({
    title: `${x.assetTag} — ${x.brand} ${x.model}`,
    wide: true,
    body: `
      <div class="form-grid">
        <div><span class="cell-sub">Status</span><div>${badge(x.status)}</div></div>
        <div><span class="cell-sub">Assigned to</span><div>${x.currentEmployee ? esc(x.currentEmployee.fullName) : '—'}</div></div>
        <div><span class="cell-sub">Serial</span><div class="mono">${esc(x.serialNumber)}</div></div>
        <div><span class="cell-sub">Category</span><div>${esc(x.category)}</div></div>
        <div><span class="cell-sub">Location</span><div>${esc(x.location || '—')}</div></div>
        <div><span class="cell-sub">MAC Ethernet</span><div class="mono">${esc(x.macEthernet || 'N/A')}</div></div>
        <div><span class="cell-sub">MAC Wi-Fi</span><div class="mono">${esc(x.macWifi || 'N/A')}</div></div>
        <div><span class="cell-sub">Specs</span><div>${esc([s.cpu, s.ram, s.storage, s.os].filter(Boolean).join(' • ') || '—')}</div></div>
        <div><span class="cell-sub">Purchase date</span><div>${fmtDate(x.purchaseDate)}</div></div>
        <div><span class="cell-sub">Lifecycle</span><div>${(() => { const l = lifecycleInfo(x);
            return `${esc(lifecycleLabel(x))} ${l.overdue ? badge('Scrap').replace('Scrap', 'Replace') : ''}`; })()}</div></div>
        <div class="full"><span class="cell-sub">QR code string</span><div class="mono">${esc(x.qrCodeString)}</div></div>
      </div>
      <h3 style="font-size:11px;text-transform:uppercase;color:var(--on-surface-variant);margin:18px 0 6px">
        History — who / when / by whom</h3>
      ${(x.history || []).length === 0 ? '<div class="cell-sub">No history yet.</div>' :
        x.history.map((h) => {
          const who = h.employeeName
            ? (h.actionType === 'returned' ? `from <strong>${esc(h.employeeName)}</strong>`
              : h.actionType === 'assigned' ? `to <strong>${esc(h.employeeName)}</strong>`
              : `while at <strong>${esc(h.employeeName)}</strong>`)
            : '';
          return `
          <div class="history-item" style="flex-wrap:wrap">
            <span class="when">${fmtDateTime(h.timestamp)}</span>
            <span>${badge(h.actionType)}</span>
            <span>${who}</span>
            <span class="cell-sub">by ${esc(h.changedByName || h.changedBy || '—')}</span>
            ${h.notes ? `<span class="cell-sub" style="flex-basis:100%;padding-left:2px">↳ ${esc(h.notes)}</span>` : ''}
          </div>`;
        }).join('')}`,
    foot: `
      <button class="btn btn-outline" data-close>Close</button>
      <button class="btn btn-outline" id="ad-qr"><span class="ms">qr_code_2</span> QR</button>
      ${canEdit ? `
        <button class="btn btn-outline" id="ad-edit"><span class="ms">edit</span> Edit</button>
        ${x.status === 'Assigned' ? '<button class="btn btn-outline" id="ad-return"><span class="ms">undo</span> Return</button>' : ''}
        ${x.status === 'In Stock' || x.status === 'Assigned' ? '<button class="btn btn-primary" id="ad-repair"><span class="ms">build</span> Repair</button>' : ''}
        ${x.status === 'In Stock' ? '<button class="btn btn-primary" id="ad-handover"><span class="ms">assignment_turned_in</span> Handover</button>' : ''}` : ''}`,
    onMount(overlay) {
      $('#ad-qr', overlay).addEventListener('click', () => showQrModal(x));
      const adHo = $('#ad-handover', overlay);
      if (adHo) adHo.addEventListener('click', () => { closeModal(); location.hash = '#/handover'; });
      const adEdit = $('#ad-edit', overlay);
      if (adEdit) adEdit.addEventListener('click', () => assetForm(x, () => { refresh(); showAssetDetail(id, onChange); }));
      const adReturn = $('#ad-return', overlay);
      if (adReturn) adReturn.addEventListener('click', () => formModal({
        title: `Return ${x.assetTag} to stock`,
        fields: [{ name: 'conditionNote', label: 'Condition note', type: 'textarea', full: true }],
        submitLabel: 'Return to stock',
        async onSubmit(d) {
          await api(`/assets/${x.id}/return`, { method: 'POST', body: d });
          toast(`${x.assetTag} returned to stock`, 'success');
          refresh();
          showAssetDetail(id, onChange);
        },
      }));
      const adRepair = $('#ad-repair', overlay);
      if (adRepair) adRepair.addEventListener('click', () => formModal({
        title: `Send ${x.assetTag} to repair`,
        fields: [
          { name: 'serviceCompany', label: 'Service company *', required: true },
          { name: 'cost', label: 'Estimated cost', type: 'number', step: '0.01' },
          { name: 'issueDescription', label: 'Issue description *', type: 'textarea', required: true, full: true },
        ],
        submitLabel: 'Send to repair',
        async onSubmit(d) {
          await api('/maintenance', { method: 'POST', body: { ...d, assetId: x.id } });
          toast(`${x.assetTag} sent to repair`, 'success');
          refresh();
          showAssetDetail(id, onChange);
        },
      }));
    },
  });
}

/* =============================== EMPLOYEES =============================== */
Views.employees = async function (el, params = {}) {
  const canEdit = Auth.can('canManageAssets');
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  q.set('limit', '1000');
  const items = await api('/employees?' + q.toString());

  const withAssets = items.filter((x) => x.activeAssetCount > 0).length;
  const coverage = items.length ? Math.round((withAssets / items.length) * 1000) / 10 : 0;
  const inactive = items.filter((x) => x.status === 'Inactive').length;

  el.innerHTML = `
    ${pageHead('Employee Directory', 'Manage personnel and their assigned IT assets.', canEdit ?
      `<button class="btn btn-primary" id="emp-new"><span class="ms">person_add</span> Add New Employee</button>` : '')}

    <div class="grid grid-4" style="margin-bottom:20px">
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Total Employees</h3>${iconChip('group', 'indigo')}</div>
        <div class="metric-value">${items.length.toLocaleString()}</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">With Active Assets</h3>${iconChip('devices', 'blue')}</div>
        <div class="metric-value">${withAssets.toLocaleString()}</div>
        <div class="metric-trend trend-flat">${coverage}% coverage</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Active</h3>${iconChip('how_to_reg', 'emerald')}</div>
        <div class="metric-value">${(items.length - inactive).toLocaleString()}</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Inactive</h3>${iconChip('person_off', 'rose')}</div>
        <div class="metric-value">${inactive.toLocaleString()}</div>
        <div class="metric-trend ${inactive ? 'trend-down' : 'trend-flat'}">${inactive ? 'Assets to recover' : '—'}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-pad" style="padding-bottom:12px;display:flex;gap:10px;align-items:center">
        <div class="search-box" style="width:300px"><span class="ms">search</span>
          <input type="search" id="emp-search" placeholder="Search by name, ID, or email…" value="${esc(params.search || '')}"></div>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Employee</th><th>ID / Sicil No</th><th>Department</th><th>Assigned Assets</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${items.length === 0 ? '<tr><td colspan="6" class="table-empty">No employees found.</td></tr>' :
            items.map((x) => `
            <tr class="emp-row" data-open="${esc(x.id)}" style="cursor:pointer" title="View assigned assets">
              <td><div style="display:flex;align-items:center;gap:12px">
                <span class="avatar">${esc(initials(x.fullName))}</span>
                <div><div class="cell-title">${esc(x.fullName)}</div><div class="cell-sub">${esc(x.email)}</div></div>
              </div></td>
              <td class="mono">${esc(String(x.id).slice(0, 8).toUpperCase())}</td>
              <td>${esc(x.department || '—')}<div class="cell-sub">${esc(x.title || '')}</div></td>
              <td><span class="badge-count ${x.activeAssetCount === 0 ? 'zero' : ''}">${x.activeAssetCount}</span></td>
              <td>${badge(x.status)}</td>
              <td class="actions">
                <button class="btn btn-outline btn-sm" data-assets="${esc(x.id)}"><span class="ms">devices</span> Assets</button>
                ${canEdit ? `<button class="btn btn-outline btn-sm" data-edit="${esc(x.id)}">Edit</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="table-foot">Showing 1 to ${items.length} of ${items.length} employees</div>
    </div>`;

  const rerender = (p) => Views.employees(el, { ...params, ...p });
  $('#emp-search', el).addEventListener('change', (e) => rerender({ search: e.target.value }));
  if (canEdit) $('#emp-new', el).addEventListener('click', () => employeeForm(null, () => rerender({})));
  bindView(el, (e) => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.edit) {
      employeeForm(items.find((x) => x.id === btn.dataset.edit), () => rerender({}));
      return;
    }
    if (btn && btn.dataset.assets) {
      showEmployeeDetail(items.find((x) => x.id === btn.dataset.assets));
      return;
    }
    const row = e.target.closest('tr.emp-row');
    if (row) showEmployeeDetail(items.find((x) => x.id === row.dataset.open));
  });
};

/* Employee detail: assigned assets + handover receipts + form regeneration. */
async function showEmployeeDetail(emp) {
  if (!emp) return;
  const canEdit = Auth.can('canManageAssets');
  const [assetsRes, receipts, software, history] = await Promise.all([
    api(`/assets?employeeId=${encodeURIComponent(emp.id)}&status=Assigned&limit=500`),
    api(`/handovers?employeeId=${encodeURIComponent(emp.id)}&limit=20`),
    api(`/licenses/assignments?employeeId=${encodeURIComponent(emp.id)}`),
    api(`/employees/${encodeURIComponent(emp.id)}/history?limit=50`).catch(() => []),
  ]);
  const assets = assetsRes.items;

  openModal({
    title: `${emp.fullName} — Assigned Assets`,
    wide: true,
    body: `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
        <span class="avatar" style="width:44px;height:44px;font-size:15px">${esc(initials(emp.fullName))}</span>
        <div>
          <div class="cell-title" style="font-size:16px">${esc(emp.fullName)}</div>
          <div class="cell-sub">${esc(emp.title || '—')} • ${esc(emp.department || '—')} • ${esc(emp.email)}</div>
        </div>
        <span style="margin-left:auto">${badge(emp.status)}</span>
      </div>

      <div class="tabs">
        <button class="tab active" data-tab="overview">Overview</button>
        <button class="tab" data-tab="history">Device History (${history.length})</button>
      </div>
      <div id="tab-overview">
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--on-surface-variant);margin:0 0 8px">
        Assigned Assets (${assets.length})</h3>
      ${assets.length === 0 ? '<div class="cell-sub" style="margin-bottom:16px">No assets currently assigned.</div>' : `
      <div class="table-wrap" style="margin-bottom:18px;border:1px solid var(--outline-variant);border-radius:var(--radius-lg)">
        <table class="data">
          <thead><tr><th>Asset Tag</th><th>Brand &amp; Model</th><th>Serial No</th><th>Category</th>${canEdit ? '<th style="text-align:right"></th>' : ''}</tr></thead>
          <tbody>
            ${assets.map((a) => `
            <tr>
              <td class="mono">${esc(a.assetTag)}</td>
              <td><div style="display:flex;align-items:center;gap:8px">
                <span class="ms" style="color:var(--on-surface-variant)">${catIcon(a.category)}</span>
                <span class="cell-title">${esc(a.brand)} ${esc(a.model)}</span></div></td>
              <td class="mono">${esc(a.serialNumber)}</td>
              <td class="cell-sub">${esc(a.category)}</td>
              ${canEdit ? `<td class="actions">
                <button class="btn btn-outline btn-sm" data-return-asset="${esc(a.id)}">
                  <span class="ms">undo</span> Return</button></td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}

      <div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 8px">
        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--on-surface-variant);margin:0">
          Assigned Software (${software.length})</h3>
        ${canEdit ? '<button class="btn btn-outline btn-sm" id="emp-assign-sw"><span class="ms">add</span> Assign Software</button>' : ''}
      </div>
      ${software.length === 0 ? '<div class="cell-sub" style="margin-bottom:16px">No software assigned.</div>' : `
      <div style="margin-bottom:18px">
        ${software.map((s) => `
        <div class="history-item" style="justify-content:space-between">
          <span><span class="ms" style="color:var(--on-surface-variant);margin-right:8px">vpn_key</span>
            <strong>${esc(s.softwareName)}</strong></span>
          <span class="cell-sub">${fmtDate(s.assignedAt)} • by ${esc(s.assignedByName || '—')}</span>
          ${canEdit ? `<button class="btn btn-outline btn-sm" data-revoke-sw="${esc(s.id)}">Revoke</button>` : ''}
        </div>`).join('')}
      </div>`}

      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--on-surface-variant);margin:0 0 8px">
        Handover Receipts (${receipts.length})</h3>
      ${receipts.length === 0 ? '<div class="cell-sub">No handover receipts yet.</div>' :
        receipts.map((h) => `
        <div class="history-item" style="justify-content:space-between">
          <span class="when">${fmtDateTime(h.transactionDate)}</span>
          <span>${(h.items || []).length} item(s) • <span class="cell-sub">${esc(h.documentType)}</span></span>
          <button class="btn btn-outline btn-sm" data-reprint="${esc(h.id)}"><span class="ms">print</span> Reprint Form</button>
        </div>`).join('')}

      </div>
      <div id="tab-history" class="hidden">
        <div class="cell-sub" style="margin-bottom:10px">Every device this employee ever held — assignments, returns and repairs.</div>
        ${history.length === 0 ? '<div class="table-empty">No device history yet.</div>' :
          `<div style="max-height:340px;overflow-y:auto">` +
          history.map((h) => `
          <div class="history-item" style="flex-wrap:wrap">
            <span class="when">${fmtDateTime(h.timestamp)}</span>
            <span>${badge(h.actionType)}</span>
            <span class="mono">${esc(h.assetTag)}</span>
            <span class="cell-sub">by ${esc(h.changedByName || '—')}</span>
            ${h.notes ? `<span class="cell-sub" style="flex-basis:100%;padding-left:2px">↳ ${esc(h.notes)}</span>` : ''}
          </div>`).join('') + '</div>'}
      </div>`,
    foot: `
      <button class="btn btn-outline" data-close>Close</button>
      <button class="btn btn-primary" id="emp-print-current" ${assets.length === 0 ? 'disabled' : ''}>
        <span class="ms">print</span> Generate Current Asset Form</button>`,
    onMount(overlay) {
      // Tab switching
      overlay.querySelectorAll('.tab').forEach((tb) => tb.addEventListener('click', () => {
        overlay.querySelectorAll('.tab').forEach((t2) => t2.classList.toggle('active', t2 === tb));
        $('#tab-overview', overlay).classList.toggle('hidden', tb.dataset.tab !== 'overview');
        $('#tab-history', overlay).classList.toggle('hidden', tb.dataset.tab !== 'history');
      }));

      // Software zimmet: assign a license seat to this employee.
      const swBtn = $('#emp-assign-sw', overlay);
      if (swBtn) swBtn.addEventListener('click', async () => {
        const licenses = (await api('/licenses')).filter((l) => l.usedSeats < l.totalSeats);
        formModal({
          title: `Assign software to ${emp.fullName}`,
          fields: [{
            name: 'licenseId', label: 'Software / License *', type: 'select', required: true,
            options: [{ value: '', label: licenses.length ? 'Select software…' : 'No licenses with free seats' },
              ...licenses.map((l) => ({ value: l.id, label: `${l.softwareName} (${l.usedSeats}/${l.totalSeats} seats)` }))],
            full: true,
          }],
          submitLabel: 'Assign software',
          async onSubmit(d) {
            if (!d.licenseId) throw new Error('Select a license');
            const r = await api(`/licenses/${d.licenseId}/assign`, { method: 'POST', body: { employeeId: emp.id } });
            toast(`${r.softwareName} assigned to ${r.employeeName}`, 'success');
            showEmployeeDetail(emp);
          },
        });
      });

      // Software zimmet düşürme: revoke a license from this employee.
      overlay.querySelectorAll('[data-revoke-sw]').forEach((rb) => rb.addEventListener('click', async () => {
        try {
          const r = await api(`/licenses/assignments/${rb.dataset.revokeSw}/revoke`, { method: 'POST' });
          toast(`${r.softwareName} revoked from ${r.employeeName}`, 'success');
          showEmployeeDetail(emp);
        } catch (err) { toast(err.message, 'error'); }
      }));

      // Return (zimmet düşürme): take an asset off this employee, back to stock.
      overlay.querySelectorAll('[data-return-asset]').forEach((b) => b.addEventListener('click', () => {
        const a = assets.find((x) => x.id === b.dataset.returnAsset);
        formModal({
          title: `Return ${a.assetTag} — ${a.brand} ${a.model}`,
          fields: [{
            name: 'conditionNote', label: 'Return condition note', type: 'textarea', full: true,
            placeholder: 'e.g. Returned in working condition / Çalışır durumda iade edildi',
          }],
          submitLabel: 'Return to stock',
          async onSubmit(d) {
            await api(`/assets/${a.id}/return`, { method: 'POST', body: d });
            toast(`${a.assetTag} returned to stock — removed from ${emp.fullName}`, 'success');
            // Refresh the employees table underneath, then reopen this detail.
            if (location.hash === '#/employees') Views.employees($('#view'));
            const fresh = (await api('/employees')).find((e) => e.id === emp.id) || emp;
            showEmployeeDetail(fresh);
          },
        });
      }));
      // Reprint a past receipt exactly as it was recorded.
      overlay.querySelectorAll('[data-reprint]').forEach((b) => b.addEventListener('click', async () => {
        printHandover(await api('/handovers/' + b.dataset.reprint));
      }));
      // Regenerate a fresh Zimmet Tutanağı covering everything currently assigned.
      const cur = $('#emp-print-current', overlay);
      if (cur) cur.addEventListener('click', () => {
        printHandover({
          id: emp.id,
          employeeId: emp.id,
          employeeName: emp.fullName,
          transactionDate: new Date().toISOString(),
          documentType: 'single',
          items: assets.map((a) => ({
            assetTag: a.assetTag,
            brand: a.brand,
            model: a.model,
            category: a.category,
            serialNumber: a.serialNumber,
            macAddress: a.macEthernet || a.macWifi || null,
            conditionNote: 'In use / Kullanımda',
          })),
        });
      });
    },
  });
}

function employeeForm(emp, done) {
  formModal({
    title: emp ? `Edit ${emp.fullName}` : 'Add New Employee',
    fields: [
      { name: 'fullName', label: 'Full name *', required: true, value: emp?.fullName },
      { name: 'email', label: 'Email *', type: 'email', required: true, value: emp?.email },
      { name: 'department', label: 'Department', value: emp?.department },
      { name: 'title', label: 'Title', value: emp?.title },
      { name: 'status', label: 'Status', type: 'select', value: emp?.status || 'Active', options: ['Active', 'Inactive'] },
    ],
    async onSubmit(d) {
      if (emp) await api(`/employees/${emp.id}`, { method: 'PUT', body: d });
      else await api('/employees', { method: 'POST', body: d });
      toast(emp ? 'Employee updated' : 'Employee created', 'success');
      done();
    },
  });
}

/* =============================== HANDOVERS =============================== */
Views.handover = async function (el) {
  const canDo = Auth.can('canExecuteHandovers');
  const [employees, past] = await Promise.all([
    api('/employees?status=Active&limit=1000'),
    api('/handovers?limit=8'),
  ]);
  let stock = [];
  let stockTotal = 0;
  const basket = new Map(); // assetId -> { asset, note }
  const state = { emp: null, empFilter: '', hwFilter: '', docType: 'single' };

  /* ---- static shell: rendered ONCE so search inputs never lose focus ---- */
  el.innerHTML = `
    ${pageHead('Handover Operations', 'Assign hardware to employees and generate handover protocols.',
      '<span class="draft-chip">Draft Mode</span>')}
    <div class="ho-grid">
      <div>
        <div class="card card-pad" style="margin-bottom:20px">
          <div class="section-title" style="margin-bottom:14px"><span class="ms">person_search</span> Select Employee</div>
          <div class="search-box" style="margin-bottom:14px"><span class="ms">search</span>
            <input type="search" id="ho-emp-search" placeholder="Search by name, email, or department…"></div>
          <div id="ho-emp-list" style="max-height:320px;overflow-y:auto"></div>
        </div>

        <div class="card">
          <div class="card-pad" style="padding-bottom:10px">
            <div class="section-title" style="justify-content:space-between">
              <span style="display:flex;align-items:center;gap:10px"><span class="ms">devices</span>
                <span id="ho-stock-count">Available Hardware</span></span>
              <span class="stock-chip">In Stock Only</span>
            </div>
          </div>
          <div style="padding:0 20px 12px">
            <div class="search-box"><span class="ms">search</span>
              <input type="search" id="ho-hw-search" placeholder="Search all in-stock assets (tag, serial, brand, model)…"></div>
          </div>
          <div class="table-wrap" style="max-height:360px;overflow-y:auto"><table class="data">
            <thead><tr><th style="width:34px"></th><th>Asset Name</th><th>Tag / SN</th><th style="text-align:right">Category</th></tr></thead>
            <tbody id="ho-stock-body"></tbody>
          </table></div>
        </div>

        <div class="card" style="margin-top:20px">
          <div class="card-head"><h3>Recent Handover Receipts</h3></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Employee</th><th>Items</th><th>Date</th><th>Type</th><th style="text-align:right"></th></tr></thead>
            <tbody>
              ${past.length === 0 ? '<tr><td colspan="5" class="table-empty">No receipts yet.</td></tr>' :
                past.map((h) => `
                <tr><td class="cell-title">${esc(h.employeeName)}</td><td>${(h.items || []).length}</td>
                  <td>${fmtDateTime(h.transactionDate)}</td><td class="cell-sub">${esc(h.documentType)}</td>
                  <td class="actions"><button class="btn btn-outline btn-sm" data-print="${esc(h.id)}"><span class="ms">print</span> Print</button></td></tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>

      <div>
        <div id="ho-sel-emp" style="margin-bottom:16px"></div>
        <div class="card basket-card">
        <div class="basket-head">
          <span class="ms ms-lg">shopping_basket</span>
          <div class="grow">
            <h3>Handover Basket</h3>
            <p id="ho-basket-sub">0 items selected</p>
          </div>
          <span class="basket-count" id="ho-basket-count">0</span>
        </div>
        <div class="basket-body" id="ho-basket-items"></div>
        <div class="doc-gen">
          <h4>Document Generation</h4>
          <label class="doc-option">
            <input type="radio" name="doctype" value="single" checked>
            <span><strong>Single Unified Document</strong>
              <span class="cell-sub">Generates one master protocol listing all items.</span></span>
          </label>
          <label class="doc-option">
            <input type="radio" name="doctype" value="separate">
            <span><strong>Separate Documents</strong>
              <span class="cell-sub">Generates individual protocols per asset.</span></span>
          </label>
        </div>
        <div class="basket-foot">
          <button class="btn btn-primary btn-lg btn-block" id="ho-submit" disabled>
            <span class="ms">print</span> Confirm Handover &amp; Print Form
          </button>
          <p class="basket-caption">This action will record the transaction and open the print dialog.</p>
        </div>
        </div>
      </div>
    </div>`;

  /* ---- partial renderers ---- */
  function renderEmps() {
    const list = $('#ho-emp-list', el);
    const emps = employees.filter((p) =>
      !state.empFilter || [p.fullName, p.email, p.department].join(' ').toLowerCase().includes(state.empFilter));
    list.innerHTML = (emps.length === 0 ? '<div class="table-empty">No matching employees.</div>' :
      emps.slice(0, 50).map((p) => `
      <div class="emp-option ${state.emp === p.id ? 'selected' : ''}" data-emp="${esc(p.id)}">
        <span class="avatar">${esc(initials(p.fullName))}</span>
        <div class="grow">
          <strong>${esc(p.fullName)}</strong>
          <span class="cell-sub">${esc(p.title || '—')} • ${esc(p.department || '—')}</span>
        </div>
        <span class="emp-radio"></span>
      </div>`).join('')) +
      (emps.length > 50 ? `<div class="cell-sub" style="padding:8px 2px">Showing first 50 of ${emps.length} — refine the search…</div>` : '');
    list.querySelectorAll('[data-emp]').forEach((r) => r.addEventListener('click', () => {
      state.emp = r.dataset.emp;
      renderEmps();
      renderSelEmp();
      renderBasket();
    }));
  }

  async function loadStock() {
    const q = new URLSearchParams({ status: 'In Stock', limit: '500' });
    if (state.hwFilter) q.set('search', state.hwFilter);
    const res = await api('/assets?' + q.toString());
    stock = res.items;
    stockTotal = res.total != null ? res.total : res.items.length;
    renderStock();
  }

  function renderStock() {
    $('#ho-stock-count', el).textContent = `Available Hardware (${stockTotal})`;
    const rows = stock.slice(0, 200);
    const tbody = $('#ho-stock-body', el);
    tbody.innerHTML = (rows.length === 0
      ? '<tr><td colspan="4" class="table-empty">No in-stock assets match your search.</td></tr>'
      : rows.map((x) => `
        <tr class="hw-row" data-hw="${esc(x.id)}">
          <td><input type="checkbox" ${basket.has(x.id) ? 'checked' : ''} ${!canDo ? 'disabled' : ''}></td>
          <td><div style="display:flex;align-items:center;gap:10px"><span class="ms" style="color:var(--on-surface-variant)">${catIcon(x.category)}</span>
            <span class="cell-title">${esc(x.brand)} ${esc(x.model)}</span></div></td>
          <td class="mono">${esc(x.assetTag)} · ${esc(x.serialNumber)}</td>
          <td style="text-align:right" class="cell-sub">${esc(x.category)}</td>
        </tr>`).join('')) +
      (stock.length > 200 ? `<tr><td colspan="4" class="cell-sub" style="padding:10px 16px">Showing first 200 of ${stock.length} — refine the search…</td></tr>` : '');
    tbody.querySelectorAll('[data-hw]').forEach((r) => r.addEventListener('click', () => {
      if (!canDo) return;
      const id = r.dataset.hw;
      if (basket.has(id)) basket.delete(id);
      else basket.set(id, { asset: stock.find((x) => x.id === id), note: '' });
      r.querySelector('input').checked = basket.has(id);
      renderBasket();
    }));
  }

  function renderSelEmp() {
    const box = $('#ho-sel-emp', el);
    const p = employees.find((x) => x.id === state.emp);
    if (!p) {
      box.innerHTML = `
        <div class="card card-pad" style="border-style:dashed;text-align:center;color:var(--outline);padding:22px">
          <span class="ms" style="font-size:30px">person_search</span>
          <div style="margin-top:6px;font-size:13px">Select an employee from the left to start the handover.</div>
        </div>`;
      return;
    }
    box.innerHTML = `
      <div class="card card-pad" style="border-color:var(--primary-container);box-shadow:0 0 0 1px var(--primary-container)">
        <div style="display:flex;align-items:center;gap:12px">
          <span class="avatar" style="width:46px;height:46px;font-size:15px">${esc(initials(p.fullName))}</span>
          <div style="flex:1;min-width:0">
            <div class="cell-title" style="font-size:15px">${esc(p.fullName)}</div>
            <div class="cell-sub">${esc(p.title || '—')} • ${esc(p.department || '—')}</div>
            <div class="cell-sub">${esc(p.email)}</div>
          </div>
          <button class="icon-btn" id="ho-clear-emp" title="Clear selection"><span class="ms">close</span></button>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:12px;padding-top:12px;border-top:1px solid var(--surface-container)">
          <span class="cell-sub">Currently holds <strong>${p.activeAssetCount}</strong> asset(s)</span>
          <span style="margin-left:auto">${badge(p.status)}</span>
        </div>
      </div>`;
    $('#ho-clear-emp', box).addEventListener('click', () => {
      state.emp = null;
      renderEmps();
      renderSelEmp();
      renderBasket();
    });
  }

  function renderBasket() {
    const selEmp = employees.find((p) => p.id === state.emp);
    $('#ho-basket-sub', el).textContent =
      `${basket.size} item${basket.size === 1 ? '' : 's'} selected${selEmp ? ' for ' + selEmp.fullName : ''}`;
    $('#ho-basket-count', el).textContent = basket.size;

    const body = $('#ho-basket-items', el);
    body.innerHTML = basket.size === 0
      ? '<div class="table-empty">Select assets from Available Hardware.</div>'
      : [...basket.values()].map(({ asset, note }) => `
        <div class="basket-item">
          <div class="basket-item-top">
            <span class="icon-chip"><span class="ms">${catIcon(asset.category)}</span></span>
            <div class="grow">
              <strong>${esc(asset.brand)} ${esc(asset.model)}</strong>
              <span class="cell-sub mono">${esc(asset.assetTag)}</span>
            </div>
            <button class="icon-btn" data-remove="${esc(asset.id)}" title="Remove"><span class="ms">close</span></button>
          </div>
          <div class="basket-note-label">Delivery Condition Note</div>
          <input data-note="${esc(asset.id)}" placeholder="Optional condition note…" value="${esc(note)}">
        </div>`).join('');

    body.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      basket.delete(b.dataset.remove);
      renderStock();
      renderBasket();
    }));
    body.querySelectorAll('[data-note]').forEach((i) => i.addEventListener('change', () => {
      basket.get(i.dataset.note).note = i.value;
    }));

    $('#ho-submit', el).disabled = !canDo || basket.size === 0 || !state.emp;
  }

  /* ---- static bindings (attached once — inputs keep focus while typing) ---- */
  $('#ho-emp-search', el).addEventListener('input', (e) => {
    state.empFilter = e.target.value.toLowerCase();
    renderEmps();
  });
  let hwTimer;
  $('#ho-hw-search', el).addEventListener('input', (e) => {
    state.hwFilter = e.target.value.trim();
    clearTimeout(hwTimer);
    hwTimer = setTimeout(() => loadStock().catch((err) => toast(err.message, 'error')), 300);
  });
  el.querySelectorAll('input[name="doctype"]').forEach((r) => r.addEventListener('change', () => {
    state.docType = r.value;
  }));
  el.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', async () => {
    printHandover(await api('/handovers/' + b.dataset.print));
  }));
  $('#ho-submit', el).addEventListener('click', async () => {
    const items = [...basket.values()].map(({ asset, note }) => ({ assetId: asset.id, conditionNote: note }));
    try {
      const receipt = await api('/handovers', {
        method: 'POST',
        body: { employeeId: state.emp, documentType: state.docType, items },
      });
      toast(`Handover recorded — ${receipt.itemCount} asset(s) assigned to ${receipt.employee.fullName}`, 'success');
      const full = await api('/handovers/' + receipt.handoverId);
      printHandover(full);
      Views.handover(el); // reload lists
    } catch (err) {
      const detail = err.details ? ' — ' + err.details.map((d) => `${d.assetTag || d.assetId}: ${d.reason}`).join('; ') : '';
      toast(err.message + detail, 'error');
    }
  });

  renderEmps();
  renderSelEmp();
  renderBasket();
  await loadStock();
};

/* Printable receipt — matches the print_preview_handover_form mockup */
async function printHandover(h) {
  let emp = null;
  try {
    // limit=1000: the default page (200) was hiding most employees, which
    // left Department/Position empty on the printed form.
    emp = (await api('/employees?limit=1000')).find((e) => e.id === h.employeeId) || null;
  } catch { /* print with what we have */ }

  const items = h.items || [];
  const groups = h.documentType === 'separate' ? items.map((i) => [i]) : [items];
  const formNo = 'HF-' + String(h.id || '').slice(0, 8).toUpperCase();
  const dateStr = fmtDate(h.transactionDate);

  // Terms come from instance settings (editable in Settings); blank line = new
  // paragraph, paragraphs after the first render italic (the TR translation).
  const termsHtml = String(AppConfig.handoverTerms || '')
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p, i) => i === 0
      ? `<p style="margin:0 0 6pt">${esc(p.trim())}</p>`
      : `<em>${esc(p.trim())}</em>`)
    .join('');

  const infoField = (label, value) => `<div class="f"><small>${label}</small><div>${esc(value || '—')}</div></div>`;

  $('#print-root').innerHTML = groups.map((group, gi) => `
    <div class="receipt">
      <div class="r-head">
        <div class="co">
          <div class="r-logo">${AppConfig.companyLogo
            ? `<img src="${esc(AppConfig.companyLogo)}" style="max-width:100%;max-height:100%;object-fit:contain" alt="logo">`
            : esc((AppConfig.companyName || 'A')[0].toUpperCase())}</div>
          <div>
            <h1>${esc((AppConfig.companyName || 'IT ASSET CONTROL PRO').toUpperCase())}</h1>
            <small>IT Asset Control Pro — Asset Management</small>
          </div>
        </div>
        <div class="r-title">
          <h2>ASSET HANDOVER FORM</h2>
          <div class="tr">(ZİMMET TUTANAĞI)</div>
          <span class="mono">Form ID: ${esc(formNo)}${groups.length > 1 ? '-' + (gi + 1) : ''}<br>Date: ${esc(dateStr)}</span>
        </div>
      </div>

      <div class="r-section">Receiving Employee Information</div>
      <div class="r-info">
        ${infoField('Full Name / Ad Soyad', h.employeeName)}
        ${infoField('Employee ID / Sicil No', emp ? String(emp.id).slice(0, 8).toUpperCase() : '')}
        ${infoField('Department / Departman', emp && emp.department)}
        ${infoField('Position / Ünvan', emp && emp.title)}
      </div>

      <div class="r-section">Equipment Details / Ekipman Detayları</div>
      <table class="r-items">
        <thead><tr><th style="width:24pt">No</th><th>Category</th><th>Brand / Model</th><th>Serial Number</th><th>MAC Address</th><th>Condition</th></tr></thead>
        <tbody>
          ${group.map((i, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${esc(i.category || '—')}</td>
            <td>${esc(i.brand)} ${esc(i.model)}</td>
            <td class="mono">${esc(i.serialNumber)}</td>
            <td class="mono">${esc(i.macAddress || 'N/A')}</td>
            <td>${esc(i.conditionNote || 'New')}</td>
          </tr>`).join('')}
          <tr><td>${group.length + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>

      <div class="r-section" style="border-bottom:none;margin-bottom:4pt">Terms and Conditions / Şartlar ve Koşullar:</div>
      <div class="r-terms">${termsHtml}</div>

      <div class="r-sigs">
        <div class="sig">
          Delivered By (IT Department)<br><small>Teslim Eden (BT Departmanı)</small>
          <div class="line">${esc((Auth.profile && Auth.profile.username) || 'IT Department')}</div>
          <small>IT Systems Administrator</small>
        </div>
        <div class="sig">
          Received By (Employee)<br><small>Teslim Alan (Çalışan)</small>
          <div class="line">${esc(h.employeeName)}</div>
          <small>Signature / İmza</small>
        </div>
      </div>

      <div class="r-return">
        <div class="r-section">Equipment Return / Ekipman İadesi</div>
        <p class="r-terms" style="margin:0 0 6pt">
          I confirm that I returned the equipment listed above. This section is signed when the
          equipment is handed back to the IT department.
          <em>Yukarıda listelenen ekipmanı iade ettiğimi onaylarım. Bu bölüm, ekipman BT departmanına
          teslim edildiğinde imzalanır.</em>
        </p>
        <div class="r-info" style="grid-template-columns:1fr 1fr 1fr">
          <div class="f"><small>Return Date / İade Tarihi</small><div>&nbsp;</div></div>
          <div class="f"><small>Condition on Return / İade Durumu</small><div>&nbsp;</div></div>
          <div class="f"><small>Missing Items / Eksikler</small><div>&nbsp;</div></div>
        </div>
        <div class="r-sigs" style="margin-top:22pt">
          <div class="sig">
            Returned By (Employee)<br><small>İade Eden (Çalışan)</small>
            <div class="line">${esc(h.employeeName)}</div>
            <small>Signature / İmza</small>
          </div>
          <div class="sig">
            Received Back By (IT Department)<br><small>İade Teslim Alan (BT Departmanı)</small>
            <div class="line">&nbsp;</div>
            <small>Name &amp; Signature / Ad ve İmza</small>
          </div>
        </div>
      </div>
    </div>`).join('');

  // On-screen print preview (matches the print_preview mockup). Calling
  // window.print() directly can be silently blocked in embedded webviews,
  // so the form is always shown on screen first with an explicit button.
  openModal({
    title: 'Print Preview — Asset Handover Form',
    wide: true,
    body: `
      <div class="edit-hint"><span class="ms ms-sm">edit</span>
        You can click into the document and edit any text before printing. (Yazdırmadan önce metne tıklayıp düzenleyebilirsiniz.)</div>
      <div style="background:var(--surface-low);padding:16px;border-radius:var(--radius-lg);max-height:58vh;overflow-y:auto">
      ${groups.map((_, gi) => `<div class="preview-paper" contenteditable="true" spellcheck="false">${
        $('#print-root').children[gi].outerHTML
      }</div>`).join('')}
    </div>`,
    foot: `
      <button class="btn btn-outline" data-close>Close</button>
      ${h.transactionDate && h.employeeId && h.id && h.id !== h.employeeId
        ? '<button class="btn btn-outline" id="do-download"><span class="ms">download</span> Download PDF</button>' : ''}
      <button class="btn btn-primary" id="do-print"><span class="ms">print</span> Print Form</button>`,
    onMount(overlay) {
      $('#do-print', overlay).addEventListener('click', () => {
        // Print exactly what the user sees (including their inline edits).
        const edited = [...overlay.querySelectorAll('.preview-paper')].map((p) => p.innerHTML).join('');
        $('#print-root').innerHTML = edited;
        window.print();
      });
      const dl = $('#do-download', overlay);
      if (dl) dl.addEventListener('click', async () => {
        dl.disabled = true;
        try {
          // Server-generated PDF (works even where the print dialog is blocked).
          const resp = await fetch(`/api/handovers/${h.id}/pdf`, {
            headers: { Authorization: 'Bearer ' + Auth.token },
          });
          if (!resp.ok) {
            const j = await resp.json().catch(() => ({}));
            throw new Error(j.error || 'PDF could not be generated');
          }
          const blob = await resp.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `zimmet-HF-${String(h.id).slice(0, 8).toUpperCase()}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          toast('Zimmet formu PDF olarak indirildi', 'success');
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          dl.disabled = false;
        }
      });
    },
  });
}

/* ============================== MAINTENANCE ============================== */
Views.maintenance = async function (el, params = {}) {
  const openOnly = params.open !== 'false';
  const logs = await api('/maintenance' + (openOnly ? '?open=true' : ''));

  el.innerHTML = `
    ${pageHead('Maintenance & Repair', 'Track devices in service and repair costs.')}
    <div class="toolbar">
      <select id="mn-filter">
        <option value="true" ${openOnly ? 'selected' : ''}>Open repairs</option>
        <option value="false" ${!openOnly ? 'selected' : ''}>All logs</option>
      </select>
      <div class="spacer"></div>
      <span class="cell-sub">To send an asset to repair, use the Repair action in Hardware Inventory.</span>
    </div>
    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr><th>Asset</th><th>Service Company</th><th>Issue</th><th>Cost</th><th>Sent</th><th>Returned</th><th style="text-align:right"></th></tr></thead>
      <tbody>
        ${logs.length === 0 ? '<tr><td colspan="7" class="table-empty">No maintenance logs.</td></tr>' :
          logs.map((m) => `
          <tr>
            <td class="mono">${esc(m.assetTag)}</td>
            <td class="cell-title">${esc(m.serviceCompany)}</td>
            <td>${esc(m.issueDescription)}</td>
            <td>${m.cost != null ? Number(m.cost).toFixed(2) : '—'}</td>
            <td>${fmtDate(m.sentDate)}</td>
            <td>${m.returnDate ? fmtDate(m.returnDate) : badge('In Repair')}</td>
            <td class="actions">
              <button class="btn btn-outline btn-sm" data-notes="${esc(m.id)}">
                <span class="ms">chat</span> Notes (${(m.progressNotes || []).length})</button>
              ${!m.returnDate ? `<button class="btn btn-outline btn-sm" data-closelog="${esc(m.id)}">Close</button>` : ''}</td>
          </tr>`).join('')}
      </tbody>
    </table></div></div>`;

  $('#mn-filter', el).addEventListener('change', (e) => Views.maintenance(el, { open: e.target.value }));
  bindView(el, (e) => {
    const nb = e.target.closest('button[data-notes]');
    if (nb) {
      showMaintNotes(logs.find((x) => x.id === nb.dataset.notes), () => Views.maintenance(el, params));
      return;
    }
    const b = e.target.closest('button[data-closelog]'); if (!b) return;
    const m = logs.find((x) => x.id === b.dataset.closelog);
    formModal({
      title: `Close repair — ${m.assetTag}`,
      fields: [
        { name: 'cost', label: 'Final cost', type: 'number', step: '0.01', value: m.cost },
        { name: 'scrap', label: 'Outcome', type: 'select', value: 'repaired',
          options: [{ value: 'repaired', label: 'Repaired — restore asset' }, { value: 'scrap', label: 'Beyond repair — scrap asset' }] },
        { name: 'resolutionNote', label: 'Resolution note', type: 'textarea', full: true },
      ],
      submitLabel: 'Close repair',
      async onSubmit(d) {
        await api(`/maintenance/${m.id}/close`, {
          method: 'PUT',
          body: { cost: d.cost, resolutionNote: d.resolutionNote, scrap: d.scrap === 'scrap' },
        });
        toast(`Repair closed for ${m.assetTag}`, 'success');
        Views.maintenance(el, params);
      },
    });
  });
};

/* =============================== LICENSES ================================ */
Views.licenses = async function (el) {
  const canEdit = Auth.can('canManageAssets');
  const items = await api('/licenses');

  el.innerHTML = `
    ${pageHead('Software & Licenses', 'Track license pools, seat usage, and renewal dates.', canEdit ?
      `<button class="btn btn-primary" id="lic-new"><span class="ms">add</span> New License</button>` : '')}
    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr><th>Software</th><th>Vendor</th><th>License Key</th><th>Seats</th><th>Expires</th><th style="text-align:right"></th></tr></thead>
      <tbody>
        ${items.length === 0 ? '<tr><td colspan="6" class="table-empty">No licenses.</td></tr>' :
          items.map((l) => {
            const pct = Math.min(100, Math.round((l.usedSeats / l.totalSeats) * 100));
            const exp = new Date(l.expirationDate && l.expirationDate._seconds ? l.expirationDate._seconds * 1000 : l.expirationDate);
            const days = Math.ceil((exp - Date.now()) / 86400000);
            return `
            <tr>
              <td><div style="display:flex;align-items:center;gap:12px">${iconChip('vpn_key', days <= 30 ? 'amber' : 'indigo')}
                <span class="cell-title">${esc(l.softwareName)}</span></div></td>
              <td>${esc(l.vendor || '—')}</td>
              <td class="mono">${esc(l.licenseKey)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="seat-bar"><i style="width:${pct}%"></i></div>
                  <span class="cell-sub">${l.usedSeats}/${l.totalSeats}</span>
                </div>
              </td>
              <td>${fmtDate(l.expirationDate)} ${days <= 30 ? `<span class="pill ${days <= 7 ? 'pill-rose' : 'pill-amber'}">${days}d</span>` : ''}</td>
              <td class="actions">
                <button class="btn btn-outline btn-sm" data-holders="${esc(l.id)}"><span class="ms">group</span> Users</button>
                ${canEdit ? `
                <button class="btn btn-primary btn-sm" data-assign="${esc(l.id)}"><span class="ms">person_add</span> Assign</button>
                <button class="btn btn-outline btn-sm" data-seat="${esc(l.id)}" data-delta="1">+ seat</button>
                <button class="btn btn-outline btn-sm" data-seat="${esc(l.id)}" data-delta="-1">− seat</button>` : ''}</td>
            </tr>`;
          }).join('')}
      </tbody>
    </table></div></div>`;

  if (canEdit) {
    $('#lic-new', el).addEventListener('click', () => formModal({
      title: 'New License',
      fields: [
        { name: 'softwareName', label: 'Software *', required: true },
        { name: 'vendor', label: 'Vendor' },
        { name: 'licenseKey', label: 'License key *', required: true },
        { name: 'totalSeats', label: 'Total seats *', type: 'number', required: true },
        { name: 'expirationDate', label: 'Expiration date *', type: 'date', required: true },
      ],
      async onSubmit(d) {
        await api('/licenses', { method: 'POST', body: d });
        toast('License created', 'success');
        Views.licenses(el);
      },
    }));
  }

  bindView(el, async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const lic = (id) => items.find((x) => x.id === id);

    if (b.dataset.seat && canEdit) {
      try {
        const r = await api(`/licenses/${b.dataset.seat}/seats`, { method: 'POST', body: { delta: Number(b.dataset.delta) } });
        toast(`${r.softwareName}: ${r.usedSeats}/${r.totalSeats} seats used`, 'success');
        Views.licenses(el);
      } catch (err) { toast(err.message, 'error'); }
    }

    // Software zimmet: assign a seat to an employee
    if (b.dataset.assign && canEdit) {
      const l = lic(b.dataset.assign);
      const employees = await api('/employees?status=Active');
      formModal({
        title: `Assign ${l.softwareName} to employee`,
        fields: [{
          name: 'employeeId', label: 'Employee *', type: 'select', required: true,
          options: [{ value: '', label: 'Select employee…' },
            ...employees.map((p) => ({ value: p.id, label: `${p.fullName} — ${p.department || ''}` }))],
          full: true,
        }],
        submitLabel: 'Assign software',
        async onSubmit(d) {
          if (!d.employeeId) throw new Error('Select an employee');
          const r = await api(`/licenses/${l.id}/assign`, { method: 'POST', body: { employeeId: d.employeeId } });
          toast(`${r.softwareName} assigned to ${r.employeeName}`, 'success');
          Views.licenses(el);
        },
      });
    }

    // Who currently holds this license
    if (b.dataset.holders) {
      const l = lic(b.dataset.holders);
      const assignments = await api(`/licenses/${l.id}/assignments`);
      openModal({
        title: `${l.softwareName} — Assigned Users (${assignments.length})`,
        body: assignments.length === 0 ? '<div class="cell-sub">No active assignments.</div>' :
          assignments.map((a) => `
          <div class="history-item" style="justify-content:space-between">
            <span><span class="avatar" style="width:26px;height:26px;font-size:10px;margin-right:8px">${esc(initials(a.employeeName))}</span>
              <strong>${esc(a.employeeName)}</strong></span>
            <span class="cell-sub">${fmtDate(a.assignedAt)} • by ${esc(a.assignedByName || '—')}</span>
            ${canEdit ? `<button class="btn btn-outline btn-sm" data-revoke-lic="${esc(a.id)}">Revoke</button>` : ''}
          </div>`).join(''),
        foot: '<button class="btn btn-outline" data-close>Close</button>',
        onMount(overlay) {
          overlay.querySelectorAll('[data-revoke-lic]').forEach((rb) => rb.addEventListener('click', async () => {
            try {
              const r = await api(`/licenses/assignments/${rb.dataset.revokeLic}/revoke`, { method: 'POST' });
              toast(`${r.softwareName} revoked from ${r.employeeName}`, 'success');
              closeModal();
              Views.licenses(el);
            } catch (err) { toast(err.message, 'error'); }
          }));
        },
      });
    }
  });
};

/* ============================== CONSUMABLES ============================== */
Views.consumables = async function (el) {
  const canEdit = Auth.can('canManageAssets');
  const items = await api('/consumables');

  el.innerHTML = `
    ${pageHead('Consumables', 'Track stock levels for toner, cables, and accessories.', canEdit ?
      `<button class="btn btn-primary" id="con-new"><span class="ms">add</span> New Item</button>` : '')}
    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr><th>Item</th><th>Stock</th><th>Min. Level</th><th>Status</th><th style="text-align:right"></th></tr></thead>
      <tbody>
        ${items.length === 0 ? '<tr><td colspan="5" class="table-empty">No consumables.</td></tr>' :
          items.map((c) => `
          <tr>
            <td><div style="display:flex;align-items:center;gap:12px">${iconChip('inventory_2', c.lowStock ? 'rose' : 'indigo')}
              <span class="cell-title">${esc(c.itemName)}</span></div></td>
            <td><strong>${c.totalStock}</strong></td>
            <td>${c.minimumStockAlertLevel}</td>
            <td>${c.lowStock ? '<span class="pill pill-rose">Low stock</span>' : '<span class="pill pill-emerald">OK</span>'}</td>
            <td class="actions">${canEdit ? `
              <button class="btn btn-outline btn-sm" data-stock="${esc(c.id)}" data-delta="-1">−1</button>
              <button class="btn btn-outline btn-sm" data-stock="${esc(c.id)}" data-delta="1">+1</button>
              <button class="btn btn-outline btn-sm" data-adjust="${esc(c.id)}">Adjust…</button>` : ''}</td>
          </tr>`).join('')}
      </tbody>
    </table></div></div>`;

  if (canEdit) {
    $('#con-new', el).addEventListener('click', () => formModal({
      title: 'New Consumable',
      fields: [
        { name: 'itemName', label: 'Item name *', required: true, full: true },
        { name: 'totalStock', label: 'Initial stock', type: 'number', value: 0 },
        { name: 'minimumStockAlertLevel', label: 'Min. alert level', type: 'number', value: 0 },
      ],
      async onSubmit(d) {
        await api('/consumables', { method: 'POST', body: d });
        toast('Consumable created', 'success');
        Views.consumables(el);
      },
    }));
    bindView(el, async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.stock) {
        try {
          const r = await api(`/consumables/${b.dataset.stock}/stock`, { method: 'POST', body: { delta: Number(b.dataset.delta) } });
          toast(`${r.itemName}: ${r.totalStock} in stock`, 'success');
          Views.consumables(el);
        } catch (err) { toast(err.message, 'error'); }
      }
      if (b.dataset.adjust) {
        const c = items.find((x) => x.id === b.dataset.adjust);
        formModal({
          title: `Adjust stock — ${c.itemName}`,
          fields: [{ name: 'delta', label: 'Change (+ restock / − consume) *', type: 'number', required: true, full: true }],
          submitLabel: 'Apply',
          async onSubmit(d) {
            const r = await api(`/consumables/${c.id}/stock`, { method: 'POST', body: { delta: d.delta } });
            toast(`${r.itemName}: ${r.totalStock} in stock`, 'success');
            Views.consumables(el);
          },
        });
      }
    });
  }
};

/* ================================= USERS ================================= */
Views.users = async function (el) {
  const items = await api('/auth/users');
  el.innerHTML = `
    ${pageHead('IT Users', 'Manage system operators and their roles.',
      `<button class="btn btn-primary" id="user-new"><span class="ms">person_add</span> New IT User</button>`)}
    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Last Login</th><th>Created</th><th style="text-align:right"></th></tr></thead>
      <tbody>
        ${items.map((u) => `
        <tr>
          <td><div style="display:flex;align-items:center;gap:12px">
            <span class="avatar">${esc(initials(u.username))}</span>
            <span class="cell-title">${esc(u.username)}</span></div></td>
          <td>${esc(u.email)}</td>
          <td>${badge(u.role)}</td>
          <td>${u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '<span class="cell-sub">Never</span>'}</td>
          <td>${fmtDate(u.createdAt)}</td>
          <td class="actions">
            <button class="btn btn-outline btn-sm" data-logins="${esc(u.uid)}" data-uname="${esc(u.username)}">
              <span class="ms">history</span> Logins</button>
            <select data-role="${esc(u.uid)}" style="width:auto">
              ${['Admin', 'Helpdesk', 'Viewer'].map((r) => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>`;

  $('#user-new', el).addEventListener('click', () => formModal({
    title: 'New IT User',
    fields: [
      { name: 'username', label: 'Display name *', required: true },
      { name: 'email', label: 'Email *', type: 'email', required: true },
      { name: 'password', label: 'Password *', type: 'password', required: true },
      { name: 'role', label: 'Role *', type: 'select', value: 'Helpdesk', options: ['Admin', 'Helpdesk', 'Viewer'] },
    ],
    submitLabel: 'Create user',
    async onSubmit(d) {
      await api('/auth/users', { method: 'POST', body: d });
      toast(`${d.role} user created`, 'success');
      Views.users(el);
    },
  }));

  el.querySelectorAll('select[data-role]').forEach((s) => s.addEventListener('change', async () => {
    try {
      await api(`/auth/users/${s.dataset.role}/role`, { method: 'PUT', body: { role: s.value } });
      toast('Role updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
      Views.users(el);
    }
  }));

  el.querySelectorAll('button[data-logins]').forEach((b) => b.addEventListener('click', async () => {
    const logs = await api(`/auth/users/${b.dataset.logins}/logins`);
    openModal({
      title: `Login history — ${b.dataset.uname}`,
      body: logs.length === 0 ? '<div class="cell-sub">No logins recorded yet.</div>' : `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>When</th><th>IP</th><th>Client</th></tr></thead>
          <tbody>
            ${logs.map((l) => `
            <tr>
              <td>${fmtDateTime(l.timestamp)}</td>
              <td class="mono">${esc(l.ip || '—')}</td>
              <td class="cell-sub" title="${esc(l.userAgent || '')}">${esc(String(l.userAgent || '—').slice(0, 60))}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>`,
      foot: '<button class="btn btn-outline" data-close>Close</button>',
    });
  }));
};

/* ============================ PRODUCT CATALOG ============================ */
Views.catalog = async function (el) {
  const canEdit = Auth.can('canManageAssets');
  const items = await api('/catalog');
  const cats = [...new Set(items.map((c) => c.category))];

  el.innerHTML = `
    ${pageHead('Product Catalog', 'Brand & model lists that power the asset form dropdowns.', canEdit ? `
      <button class="btn btn-outline" id="cat-import"><span class="ms">sync</span> Import from existing assets</button>
      <button class="btn btn-primary" id="cat-new"><span class="ms">add</span> Add Model</button>` : '')}
    ${items.length === 0 ? `
      <div class="card card-pad" style="text-align:center;padding:48px">
        <div class="cell-sub" style="margin-bottom:14px">The catalog is empty. Import every brand/model already in your
        inventory with one click, or add models manually.</div>
      </div>` :
      cats.map((cat) => `
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><h3>${esc(cat)} (${items.filter((c) => c.category === cat).length})</h3></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Brand</th><th>Model</th><th style="text-align:right"></th></tr></thead>
          <tbody>
            ${items.filter((c) => c.category === cat).map((c) => `
            <tr>
              <td class="cell-title">${esc(c.brand)}</td>
              <td>${esc(c.model)}</td>
              <td class="actions">${canEdit ? `<button class="btn btn-outline btn-sm" data-del="${esc(c.id)}">Delete</button>` : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`).join('')}`;

  if (canEdit) {
    $('#cat-new', el).addEventListener('click', () => formModal({
      title: 'Add catalog model',
      fields: [
        { name: 'category', label: 'Category *', type: 'select', required: true, value: 'Laptop',
          options: ['Laptop', 'Desktop', 'Monitor', 'Phone', 'Tablet', 'Printer', 'Network', 'Peripheral', 'Other'] },
        { name: 'brand', label: 'Brand *', required: true },
        { name: 'model', label: 'Model *', required: true, full: true },
      ],
      submitLabel: 'Add to catalog',
      async onSubmit(d) {
        await api('/catalog', { method: 'POST', body: d });
        toast(`${d.brand} ${d.model} added to catalog`, 'success');
        Views.catalog(el);
      },
    }));
    $('#cat-import', el).addEventListener('click', async () => {
      try {
        const r = await api('/catalog/import', { method: 'POST' });
        toast(`${r.imported} brand/model entries imported from inventory`, 'success');
        Views.catalog(el);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ---- Office Locations (stored in settings, drives asset form dropdown) ---- */
  const locData = await api('/catalog/locations').catch(() => ({ locations: [], defaultLocation: null }));
  el.insertAdjacentHTML('beforeend', `
    <div class="card" style="margin-top:4px">
      <div class="card-head">
        <h3>Office Locations (${locData.locations.length})</h3>
        ${canEdit ? '<button class="btn btn-primary btn-sm" id="loc-add"><span class="ms">add_location_alt</span> Add Location</button>' : ''}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Location</th><th>Default</th><th style="text-align:right"></th></tr></thead>
        <tbody>
          ${locData.locations.map((l) => `
          <tr>
            <td><div style="display:flex;align-items:center;gap:10px"><span class="ms" style="color:var(--on-surface-variant)">location_on</span>
              <span class="cell-title">${esc(l)}</span></div></td>
            <td>${locData.defaultLocation === l
              ? '<span class="pill pill-indigo">Default</span>'
              : (canEdit ? `<button class="btn btn-outline btn-sm" data-setdef="${esc(l)}">Set default</button>` : '—')}</td>
            <td class="actions">${canEdit ? `<button class="btn btn-outline btn-sm" data-delloc="${esc(l)}">Delete</button>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="table-foot">New assets default to the location marked as Default; each asset's location can be changed on its form.</div>
    </div>`);

  /* ---- Hardware spec lists (cpu / ram / storage) ---- */
  const specs = await api('/catalog/specs').catch(() => ({ cpu: [], ram: [], storage: [] }));
  el.insertAdjacentHTML('beforeend', `
    <div class="card" style="margin-top:16px">
      <div class="card-head"><h3>Hardware Spec Lists</h3>
        <span class="cell-sub">These lists feed the CPU / RAM / Storage dropdowns on the asset form and the report filters.</span></div>
      <div class="card-pad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${['cpu', 'ram', 'storage'].map((type) => `
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span class="gs-section" style="margin:0">${type.toUpperCase()} (${specs[type].length})</span>
            ${canEdit ? `<button class="btn btn-outline btn-sm" data-addspec="${type}"><span class="ms">add</span></button>` : ''}
          </div>
          ${specs[type].map((v) => `
          <div class="history-item" style="justify-content:space-between">
            <span>${esc(v)}</span>
            ${canEdit ? `<button class="icon-btn" style="width:26px;height:26px" data-delspec="${type}" data-val="${esc(v)}" title="Delete"><span class="ms ms-sm">close</span></button>` : ''}
          </div>`).join('')}
        </div>`).join('')}
      </div>
    </div>`);

  if (canEdit) {
    $('#loc-add', el).addEventListener('click', () => formModal({
      title: 'Add office location',
      fields: [{ name: 'name', label: 'Location name *', required: true, full: true, placeholder: 'e.g. Ankara Branch' }],
      submitLabel: 'Add location',
      async onSubmit(d2) {
        const r = await api('/catalog/locations', { method: 'POST', body: { name: d2.name } });
        AppConfig.locations = r.locations;
        toast(`Location "${d2.name}" added`, 'success');
        Views.catalog(el);
      },
    }));
  }

  bindView(el, async (e) => {
    const b = e.target.closest('button'); if (!b || !canEdit) return;
    try {
      if (b.dataset.del) {
        await api('/catalog/' + b.dataset.del, { method: 'DELETE' });
        toast('Catalog entry removed', 'success');
        Views.catalog(el);
      } else if (b.dataset.setdef) {
        const r = await api('/catalog/locations/default', { method: 'PUT', body: { name: b.dataset.setdef } });
        AppConfig.defaultLocation = r.defaultLocation;
        toast(`Default location set to ${b.dataset.setdef}`, 'success');
        Views.catalog(el);
      } else if (b.dataset.addspec) {
        const type = b.dataset.addspec;
        formModal({
          title: `Add ${type.toUpperCase()} option`,
          fields: [{ name: 'value', label: `${type.toUpperCase()} value *`, required: true, full: true,
            placeholder: type === 'cpu' ? 'e.g. Intel i7-1455U' : type === 'ram' ? 'e.g. 48GB' : 'e.g. 4TB SSD' }],
          submitLabel: 'Add to list',
          async onSubmit(d2) {
            const r = await api('/catalog/specs', { method: 'POST', body: { type, value: d2.value } });
            AppConfig.specOptions = r;
            toast(`"${d2.value}" added to ${type.toUpperCase()} list`, 'success');
            Views.catalog(el);
          },
        });
      } else if (b.dataset.delspec) {
        const r = await api(`/catalog/specs/${b.dataset.delspec}/${encodeURIComponent(b.dataset.val)}`, { method: 'DELETE' });
        AppConfig.specOptions = r;
        toast('Spec option removed', 'success');
        Views.catalog(el);
      } else if (b.dataset.delloc) {
        confirmModal(`Delete location "${b.dataset.delloc}"? Assets keep their stored location text.`, async () => {
          const r = await api('/catalog/locations/' + encodeURIComponent(b.dataset.delloc), { method: 'DELETE' });
          AppConfig.locations = r.locations;
          AppConfig.defaultLocation = r.defaultLocation;
          toast('Location deleted', 'success');
          Views.catalog(el);
        });
      }
    } catch (err) { toast(err.message, 'error'); }
  });
};

/* Repair progress notes: view + append; every note also lands in device history. */
function showMaintNotes(log, onDone) {
  if (!log) return;
  const notes = log.progressNotes || [];
  openModal({
    title: `Repair notes — ${log.assetTag}`,
    body: `
      <div class="cell-sub" style="margin-bottom:12px">${esc(log.serviceCompany)} • ${esc(log.issueDescription)}
        • sent ${fmtDate(log.sentDate)}${log.returnDate ? ' • closed ' + fmtDate(log.returnDate) : ''}</div>
      ${notes.length === 0 ? '<div class="cell-sub" style="margin-bottom:8px">No progress notes yet.</div>' :
        notes.map((n) => `
        <div class="history-item" style="flex-wrap:wrap">
          <span class="when">${fmtDateTime(n.at)}</span>
          <span class="cell-sub">by ${esc(n.by || '—')}</span>
          <span style="flex-basis:100%;padding-left:2px">${esc(n.note)}</span>
        </div>`).join('')}
      <div class="form-field" style="margin-top:14px">
        <label>Add progress note <span class="ob-hint">(also recorded in the device history)</span></label>
        <textarea id="mn-new-note" placeholder="e.g. Parça bekleniyor — ekran paneli siparişi verildi"></textarea>
      </div>`,
    foot: `<button class="btn btn-outline" data-close>Close</button>
           <button class="btn btn-primary" id="mn-add-note"><span class="ms">add_comment</span> Add Note</button>`,
    onMount(overlay) {
      $('#mn-add-note', overlay).addEventListener('click', async () => {
        const note = $('#mn-new-note', overlay).value.trim();
        if (!note) return toast('Write a note first', 'error');
        try {
          const r = await api(`/maintenance/${log.id}/note`, { method: 'POST', body: { note } });
          toast(`Note added to ${log.assetTag} — recorded in device history`, 'success');
          log.progressNotes = [...notes, r.entry];
          showMaintNotes(log, onDone); // reopen with the new note visible
          if (onDone) onDone();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

/* ================================ REPORTS ================================ */
function csvDownload(filename, cols, rows) {
  const csvEsc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  // \uFEFF BOM so Excel opens Turkish characters correctly.
  const csv = '\uFEFF' + [cols, ...rows].map((r) => r.map(csvEsc).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
}

const REPORT_DEFS = [
  { id: 'inventory', icon: 'devices', tone: 'indigo', title: 'Full Inventory Report',
    desc: 'Every asset with status, holder, purchase date and identifiers.' },
  { id: 'assignments', icon: 'handshake', tone: 'blue', title: 'Assigned Assets by Employee',
    desc: 'Zimmet listesi — who currently holds which device, by department.' },
  { id: 'maintenance', icon: 'build', tone: 'amber', title: 'Maintenance & Cost Report',
    desc: 'All repair logs with service company, duration and total cost.' },
  { id: 'licenses', icon: 'vpn_key', tone: 'indigo', title: 'License Utilization Report',
    desc: 'Seat usage, utilization % and upcoming expirations.' },
  { id: 'software', icon: 'workspace_premium', tone: 'emerald', title: 'Software Assignments Report',
    desc: 'Which employee holds which software license, assigned when and by whom.' },
  { id: 'consumables', icon: 'inventory_2', tone: 'rose', title: 'Consumables Stock Report',
    desc: 'Stock levels vs minimum alert levels with low-stock flags.' },
];

async function buildReport(id) {
  if (id === 'inventory') {
    const { items } = await api('/assets?limit=2000');
    return {
      cols: ['Asset Tag', 'Category', 'Brand', 'Model', 'Serial No', 'MAC', 'Status', 'Assigned To', 'Purchase Date'],
      rows: items.map((x) => [x.assetTag, x.category, x.brand, x.model, x.serialNumber,
        x.macEthernet || x.macWifi || '', x.status, x.currentEmployee ? x.currentEmployee.fullName : '',
        x.purchaseDate ? fmtDate(x.purchaseDate) : '']),
      summary: `${items.length} assets • ${items.filter((x) => x.status === 'Assigned').length} assigned • ` +
        `${items.filter((x) => x.status === 'In Stock').length} in stock • ` +
        `${items.filter((x) => x.status === 'In Repair').length} in repair • ` +
        `${items.filter((x) => x.status === 'Scrap').length} scrapped`,
    };
  }
  if (id === 'assignments') {
    const [{ items }, employees] = await Promise.all([
      api('/assets?status=Assigned&limit=2000'),
      api('/employees?limit=1000'),
    ]);
    const dept = new Map(employees.map((p) => [p.id, p]));
    const rows = items
      .map((x) => {
        const p = x.currentEmployee ? dept.get(x.currentEmployee.id) : null;
        return [x.currentEmployee ? x.currentEmployee.fullName : '', p ? p.department || '' : '',
          x.assetTag, `${x.brand} ${x.model}`, x.category, x.serialNumber];
      })
      .sort((a2, b2) => a2[0].localeCompare(b2[0]));
    return {
      cols: ['Employee', 'Department', 'Asset Tag', 'Brand / Model', 'Category', 'Serial No'],
      rows,
      summary: `${items.length} assigned assets across ${new Set(rows.map((r) => r[0])).size} employees`,
    };
  }
  if (id === 'maintenance') {
    const logs = await api('/maintenance?limit=2000');
    const totalCost = logs.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);
    return {
      cols: ['Asset Tag', 'Service Company', 'Issue', 'Sent', 'Returned', 'Days', 'Cost', 'Status', 'Notes'],
      rows: logs.map((m) => {
        const sent = new Date(m.sentDate);
        const back = m.returnDate ? new Date(m.returnDate) : new Date();
        return [m.assetTag, m.serviceCompany, m.issueDescription, fmtDate(m.sentDate),
          m.returnDate ? fmtDate(m.returnDate) : '', Math.max(0, Math.round((back - sent) / 86400000)),
          Number(m.cost || 0).toFixed(2), m.returnDate ? 'Closed' : 'Open', (m.progressNotes || []).length];
      }),
      summary: `${logs.length} repair logs • ${logs.filter((m) => !m.returnDate).length} open • ` +
        `total cost ${totalCost.toFixed(2)}`,
    };
  }
  if (id === 'licenses') {
    const lics = await api('/licenses');
    return {
      cols: ['Software', 'Vendor', 'Used Seats', 'Total Seats', 'Utilization %', 'Expires'],
      rows: lics.map((l) => [l.softwareName, l.vendor || '', l.usedSeats, l.totalSeats,
        Math.round((l.usedSeats / l.totalSeats) * 100), fmtDate(l.expirationDate)]),
      summary: `${lics.length} license pools • ${lics.reduce((s2, l) => s2 + l.usedSeats, 0)}/` +
        `${lics.reduce((s2, l) => s2 + l.totalSeats, 0)} seats in use`,
    };
  }
  if (id === 'software') {
    const rows = await api('/licenses/assignments');
    return {
      cols: ['Employee', 'Software', 'Assigned At', 'Assigned By'],
      rows: rows.map((a2) => [a2.employeeName, a2.softwareName, fmtDate(a2.assignedAt), a2.assignedByName || '']),
      summary: `${rows.length} active software assignments`,
    };
  }
  // consumables
  const cons = await api('/consumables');
  return {
    cols: ['Item', 'Stock', 'Min. Level', 'Status'],
    rows: cons.map((c) => [c.itemName, c.totalStock, c.minimumStockAlertLevel, c.lowStock ? 'LOW STOCK' : 'OK']),
    summary: `${cons.length} items • ${cons.filter((c) => c.lowStock).length} below minimum`,
  };
}

/* ---- Custom report builder: any source × any columns × filters ---- */
const CRB_CATS = ['Laptop', 'Desktop', 'Monitor', 'Phone', 'Tablet', 'Printer', 'Network', 'Peripheral', 'Other'];
const CUSTOM_SOURCES = {
  assets: {
    label: 'Hardware Assets',
    fetch: async () => (await api('/assets?limit=2000')).items,
    columns: [
      ['assetTag', 'Asset Tag', (x) => x.assetTag],
      ['category', 'Category', (x) => x.category],
      ['brand', 'Brand', (x) => x.brand],
      ['model', 'Model', (x) => x.model],
      ['serialNumber', 'Serial No', (x) => x.serialNumber],
      ['mac', 'MAC', (x) => x.macEthernet || x.macWifi || ''],
      ['status', 'Status', (x) => x.status],
      ['employee', 'Assigned To', (x) => (x.currentEmployee ? x.currentEmployee.fullName : '')],
      ['purchaseDate', 'Purchase Date', (x) => (x.purchaseDate ? fmtDate(x.purchaseDate) : '')],
      ['cpu', 'CPU', (x) => (x.specs && x.specs.cpu) || ''],
      ['ram', 'RAM', (x) => (x.specs && x.specs.ram) || ''],
      ['storage', 'Storage', (x) => (x.specs && x.specs.storage) || ''],
      ['os', 'OS', (x) => (x.specs && x.specs.os) || ''],
      ['location', 'Location', (x) => x.location || ''],
      ['eol', 'Lifecycle EOL', (x) => { const l = lifecycleInfo(x); return l.eol ? fmtDate(l.eol) : ''; }],
      ['lifecycle', 'Lifecycle State', (x) => { const l = lifecycleInfo(x);
        return l.pct == null ? '' : (l.overdue ? 'OVERDUE' : Math.min(l.pct, 100) + '%'); }],
    ],
    filters: [
      { key: 'location', label: 'Location', type: 'select',
        get options() { return ['', ...(AppConfig.locations || [])]; },
        apply: (x, v) => x.location === v },
      { key: 'cpu', label: 'CPU', type: 'select',
        get options() { return ['', ...((AppConfig.specOptions || {}).cpu || [])]; },
        apply: (x, v) => (x.specs && x.specs.cpu) === v },
      { key: 'ram', label: 'RAM', type: 'select',
        get options() { return ['', ...((AppConfig.specOptions || {}).ram || [])]; },
        apply: (x, v) => (x.specs && x.specs.ram) === v },
      { key: 'storage', label: 'Storage', type: 'select',
        get options() { return ['', ...((AppConfig.specOptions || {}).storage || [])]; },
        apply: (x, v) => (x.specs && x.specs.storage) === v },
      { key: 'lifecycle', label: 'Lifecycle', type: 'select',
        options: [{ value: '', label: 'Lifecycle: all' }, { value: 'overdue', label: 'Past EOL (replace)' }, { value: 'ok', label: 'Within lifecycle' }],
        apply: (x, v) => (v === 'overdue' ? lifecycleInfo(x).overdue : !lifecycleInfo(x).overdue) },
      { key: 'status', label: 'Status', type: 'select', options: ['', 'In Stock', 'Assigned', 'In Repair', 'Scrap'],
        apply: (x, v) => x.status === v },
      { key: 'category', label: 'Category', type: 'select', options: ['', ...CRB_CATS],
        apply: (x, v) => x.category === v },
      { key: 'from', label: 'Purchased from', type: 'date',
        apply: (x, v) => x.purchaseDate && new Date(x.purchaseDate) >= new Date(v) },
      { key: 'to', label: 'Purchased to', type: 'date',
        apply: (x, v) => x.purchaseDate && new Date(x.purchaseDate) <= new Date(v + 'T23:59:59') },
    ],
  },
  employees: {
    label: 'Employees',
    fetch: async () => api('/employees?limit=1000'),
    columns: [
      ['fullName', 'Employee', (x) => x.fullName],
      ['email', 'Email', (x) => x.email],
      ['department', 'Department', (x) => x.department || ''],
      ['title', 'Title', (x) => x.title || ''],
      ['status', 'Status', (x) => x.status],
      ['activeAssetCount', 'Assets Held', (x) => x.activeAssetCount],
    ],
    filters: [
      { key: 'status', label: 'Status', type: 'select', options: ['', 'Active', 'Inactive'], apply: (x, v) => x.status === v },
      { key: 'department', label: 'Department contains', type: 'text',
        apply: (x, v) => (x.department || '').toLowerCase().includes(v.toLowerCase()) },
      { key: 'holders', label: 'Asset holders', type: 'select',
        options: [{ value: '', label: 'All' }, { value: 'yes', label: 'Holds assets' }, { value: 'no', label: 'Holds none' }],
        apply: (x, v) => (v === 'yes' ? x.activeAssetCount > 0 : x.activeAssetCount === 0) },
    ],
  },
  maintenance: {
    label: 'Maintenance Logs',
    fetch: async () => api('/maintenance?limit=2000'),
    columns: [
      ['assetTag', 'Asset Tag', (x) => x.assetTag],
      ['serviceCompany', 'Service Company', (x) => x.serviceCompany],
      ['issueDescription', 'Issue', (x) => x.issueDescription],
      ['sentDate', 'Sent', (x) => fmtDate(x.sentDate)],
      ['returnDate', 'Returned', (x) => (x.returnDate ? fmtDate(x.returnDate) : '')],
      ['days', 'Days', (x) => Math.max(0, Math.round(((x.returnDate ? new Date(x.returnDate) : new Date()) - new Date(x.sentDate)) / 86400000))],
      ['cost', 'Cost', (x) => Number(x.cost || 0).toFixed(2)],
      ['state', 'State', (x) => (x.returnDate ? 'Closed' : 'Open')],
      ['notes', 'Notes', (x) => (x.progressNotes || []).map((n) => n.note).join(' | ')],
    ],
    filters: [
      { key: 'state', label: 'State', type: 'select', options: ['', 'Open', 'Closed'],
        apply: (x, v) => (x.returnDate ? 'Closed' : 'Open') === v },
      { key: 'from', label: 'Sent from', type: 'date', apply: (x, v) => new Date(x.sentDate) >= new Date(v) },
      { key: 'to', label: 'Sent to', type: 'date', apply: (x, v) => new Date(x.sentDate) <= new Date(v + 'T23:59:59') },
    ],
  },
  licenses: {
    label: 'Licenses',
    fetch: async () => api('/licenses'),
    columns: [
      ['softwareName', 'Software', (x) => x.softwareName],
      ['vendor', 'Vendor', (x) => x.vendor || ''],
      ['usedSeats', 'Used Seats', (x) => x.usedSeats],
      ['totalSeats', 'Total Seats', (x) => x.totalSeats],
      ['util', 'Utilization %', (x) => Math.round((x.usedSeats / x.totalSeats) * 100)],
      ['expirationDate', 'Expires', (x) => fmtDate(x.expirationDate)],
    ],
    filters: [
      { key: 'expiring', label: 'Expiring within (days)', type: 'number',
        apply: (x, v) => {
          const exp = new Date(x.expirationDate && x.expirationDate._seconds ? x.expirationDate._seconds * 1000 : x.expirationDate);
          const days = Math.ceil((exp - Date.now()) / 86400000);
          return days >= 0 && days <= Number(v);
        } },
    ],
  },
  software: {
    label: 'Software Assignments',
    fetch: async () => api('/licenses/assignments?includeRevoked=true'),
    columns: [
      ['employeeName', 'Employee', (x) => x.employeeName],
      ['softwareName', 'Software', (x) => x.softwareName],
      ['assignedAt', 'Assigned At', (x) => fmtDate(x.assignedAt)],
      ['assignedByName', 'Assigned By', (x) => x.assignedByName || ''],
      ['state', 'State', (x) => (x.revokedAt ? 'Revoked' : 'Active')],
      ['revokedAt', 'Revoked At', (x) => (x.revokedAt ? fmtDate(x.revokedAt) : '')],
    ],
    filters: [
      { key: 'state', label: 'State', type: 'select', options: ['', 'Active', 'Revoked'],
        apply: (x, v) => (x.revokedAt ? 'Revoked' : 'Active') === v },
    ],
  },
  consumables: {
    label: 'Consumables',
    fetch: async () => api('/consumables'),
    columns: [
      ['itemName', 'Item', (x) => x.itemName],
      ['totalStock', 'Stock', (x) => x.totalStock],
      ['minimumStockAlertLevel', 'Min. Level', (x) => x.minimumStockAlertLevel],
      ['state', 'Status', (x) => (x.lowStock ? 'LOW STOCK' : 'OK')],
    ],
    filters: [
      { key: 'low', label: 'Stock level', type: 'select',
        options: [{ value: '', label: 'All' }, { value: 'low', label: 'Low stock only' }, { value: 'ok', label: 'Healthy only' }],
        apply: (x, v) => (v === 'low' ? x.lowStock : !x.lowStock) },
    ],
  },
  handovers: {
    label: 'Handover Receipts',
    fetch: async () => api('/handovers?limit=200'),
    columns: [
      ['employeeName', 'Employee', (x) => x.employeeName],
      ['items', 'Items', (x) => (x.items || []).length],
      ['tags', 'Asset Tags', (x) => (x.items || []).map((i) => i.assetTag).join(', ')],
      ['transactionDate', 'Date', (x) => fmtDateTime(x.transactionDate)],
      ['documentType', 'Type', (x) => x.documentType],
    ],
    filters: [
      { key: 'from', label: 'From', type: 'date', apply: (x, v) => new Date(x.transactionDate) >= new Date(v) },
      { key: 'to', label: 'To', type: 'date', apply: (x, v) => new Date(x.transactionDate) <= new Date(v + 'T23:59:59') },
    ],
  },
};

/* Shared result renderer: preview table + Export CSV + Print. */
function showReportResult(slot, title, rep) {
  const shown = rep.rows.slice(0, 100);
  slot.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>${esc(title)} — ${new Date().toLocaleDateString()}</h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" id="rep-print"><span class="ms">print</span> Print</button>
          <button class="btn btn-primary btn-sm" id="rep-csv"><span class="ms">download</span> Export CSV</button>
        </div>
      </div>
      <div class="card-pad" style="padding-bottom:8px"><span class="cell-sub">${esc(rep.summary)}</span></div>
      <div class="table-wrap" style="max-height:480px;overflow-y:auto"><table class="data">
        <thead><tr>${rep.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${shown.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}
          ${rep.rows.length > 100 ? `<tr><td colspan="${rep.cols.length}" class="cell-sub" style="padding:10px 16px">
            Preview shows first 100 of ${rep.rows.length} rows — the CSV export contains everything.</td></tr>` : ''}
        </tbody>
      </table></div>
      <div class="table-foot">${rep.rows.length} rows</div>
    </div>`;
  slot.scrollIntoView({ behavior: 'smooth', block: 'start' });

  $('#rep-csv', slot).addEventListener('click', () =>
    csvDownload(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, rep.cols, rep.rows));
  $('#rep-print', slot).addEventListener('click', () => {
    $('#print-root').innerHTML = `
      <div class="receipt">
        <div class="r-head">
          <div class="co">
            <div class="r-logo">${AppConfig.companyLogo
              ? `<img src="${esc(AppConfig.companyLogo)}" style="max-width:100%;max-height:100%;object-fit:contain">`
              : esc((AppConfig.companyName || 'A')[0].toUpperCase())}</div>
            <div><h1>${esc((AppConfig.companyName || '').toUpperCase())}</h1>
              <small>${esc(title)} — ${new Date().toLocaleString()}</small></div>
          </div>
        </div>
        <div class="r-terms" style="margin-bottom:8pt">${esc(rep.summary)}</div>
        <table class="r-items">
          <thead><tr>${rep.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${rep.rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
    window.print();
  });
}

Views.reports = async function (el) {
  /* ---- data for the analytics layer (all from existing endpoints) ---- */
  const [assetsRes, maintenance, handovers] = await Promise.all([
    api('/assets?limit=2000'),
    api('/maintenance?limit=2000'),
    api('/handovers?limit=200'),
  ]);
  const assets = assetsRes.items;
  const state = { range: 30, page: 1 };
  const PAGE = 8;
  const toDate = (v) => new Date(v && v._seconds ? v._seconds * 1000 : v);
  const MONTH_MS = 30.44 * 86400000;

  function computeAnalytics() {
    const now = Date.now();
    const rangeMs = state.range ? state.range * 86400000 : Infinity;
    const inRange = (d) => d && (now - toDate(d).getTime()) <= rangeMs && toDate(d).getTime() <= now + 86400000;

    const active = assets.filter((x) => x.status !== 'Scrap');
    const purchased = assets.filter((x) => x.purchaseDate && inRange(x.purchaseDate));
    const prior = state.range ? assets.filter((x) => {
      if (!x.purchaseDate) return false;
      const age = now - toDate(x.purchaseDate).getTime();
      return age > rangeMs && age <= rangeMs * 2;
    }) : [];
    const procTrend = prior.length ? Math.round(((purchased.length - prior.length) / prior.length) * 100) : null;

    const lc = AppConfig.lifecycles || {};
    const avgLifecycle = active.length
      ? Math.round(active.reduce((s, x) => s + (lc[x.category] || lc.Other || 48), 0) / active.length) : 0;
    const withPd = active.filter((x) => x.purchaseDate);
    const avgAge = withPd.length
      ? Math.round(withPd.reduce((s, x) => s + (now - toDate(x.purchaseDate).getTime()), 0) / withPd.length / MONTH_MS) : 0;

    const maintInRange = maintenance.filter((m) => inRange(m.sentDate));
    const spend = maintInRange.reduce((s, m) => s + Number(m.cost || 0), 0);
    const openRepairs = maintenance.filter((m) => !m.returnDate).length;

    // Inventory growth: cumulative fleet size at each of the last 10 month-ends
    const growth = [];
    const base = new Date(); base.setDate(1);
    for (let i = 9; i >= 0; i--) {
      const m = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
      growth.push({
        label: m.toLocaleString('en', { month: 'short' }),
        value: assets.filter((x) => x.purchaseDate && toDate(x.purchaseDate).getTime() < end).length,
      });
    }

    const STATUSES = [
      ['Assigned', '#3525cd'], ['In Stock', '#c3c0ff'], ['In Repair', '#565e74'], ['Scrap', '#ffb4ab'],
    ];
    const statusData = STATUSES.map(([s, color]) => ({
      status: s, color, count: assets.filter((x) => x.status === s).length,
    }));

    const events = [
      ...handovers.flatMap((h) => (h.items || []).map((i) => ({
        date: toDate(h.transactionDate), type: 'Handover',
        model: `${i.brand} ${i.model}`, tag: i.assetTag, who: h.employeeName, cost: null,
      }))),
      ...assets.filter((x) => x.purchaseDate).map((x) => ({
        date: toDate(x.purchaseDate), type: 'Procurement',
        model: `${x.brand} ${x.model}`, tag: x.assetTag, who: 'IT Stock', cost: null,
      })),
      ...maintenance.map((m) => ({
        date: toDate(m.sentDate), type: 'Repair',
        model: m.assetTag, tag: m.assetTag, who: m.serviceCompany, cost: Number(m.cost || 0),
      })),
    ].filter((e) => inRange(e.date)).sort((a, b) => b.date - a.date);

    return { totalActive: active.length, purchased, procTrend, avgLifecycle, avgAge, spend, openRepairs, growth, statusData, events };
  }

  /* ---- static shell: analytics slot + existing builder/presets kept below ---- */
  el.innerHTML = `
    ${pageHead('Reports & Analytics', 'Comprehensive view of your IT asset landscape.', `
      <select id="rep-range" style="width:auto">
        <option value="30">Last 30 Days</option>
        <option value="90">Last 90 Days</option>
        <option value="365">Last 12 Months</option>
        <option value="0">All Time</option>
      </select>
      <button class="btn btn-outline" id="rep-export-events"><span class="ms">download</span> Export Report</button>`)}

    <div id="rep-analytics"></div>

    <div class="gs-section" style="margin:24px 0 8px">Custom Report Builder</div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-pad">
        <div class="form-grid">
          <div class="form-field">
            <label>Data source</label>
            <select id="crb-source">
              ${Object.entries(CUSTOM_SOURCES).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field"><label>Filters <span class="ob-hint">(leave empty to include everything)</span></label>
            <div id="crb-filters" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div></div>
          <div class="form-field full"><label>Columns</label>
            <div id="crb-cols" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>
        </div>
        <button id="crb-generate" class="btn btn-primary" style="margin-top:14px">
          <span class="ms">table_view</span> Generate Report</button>
      </div>
    </div>

    <div class="gs-section" style="margin-bottom:8px">Preset Reports</div>
    <div class="grid grid-2" id="report-cards">
      ${REPORT_DEFS.map((r) => `
      <div class="card card-pad gs-item" data-report="${r.id}" style="align-items:flex-start">
        ${iconChip(r.icon, r.tone)}
        <div style="flex:1">
          <div class="cell-title" style="font-size:15px">${esc(r.title)}</div>
          <div class="cell-sub">${esc(r.desc)}</div>
        </div>
        <span class="ms" style="color:var(--outline)">chevron_right</span>
      </div>`).join('')}
    </div>
    <div id="report-result" style="margin-top:20px"></div>`;

  /* ---- analytics renderer (re-runs on range / page change only) ---- */
  function renderAnalytics() {
    const a = computeAnalytics();
    const rangeLabel = state.range === 0 ? 'all time' : `last ${state.range} days`;

    const maxG = Math.max(...a.growth.map((g) => g.value), 1);
    const barsHtml = a.growth.map((g, i) => `
      <div class="bar-col" title="${esc(g.label)}: ${g.value} assets">
        <div class="bar ${i === a.growth.length - 1 ? 'hot' : ''}" style="height:${Math.max(3, (g.value / maxG) * 100)}%"></div>
        <span class="bar-label">${esc(g.label)}</span>
      </div>`).join('');

    const totalStatus = a.statusData.reduce((s, x) => s + x.count, 0) || 1;
    let acc = 0;
    const R = 74, C = 2 * Math.PI * R;
    const segs = a.statusData.map((x) => {
      const frac = x.count / totalStatus;
      const seg = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${x.color}" stroke-width="22"
        stroke-dasharray="${(frac * C).toFixed(1)} ${C.toFixed(1)}"
        stroke-dashoffset="${(-acc * C).toFixed(1)}" transform="rotate(-90 100 100)"/>`;
      acc += frac;
      return seg;
    }).join('');

    const pages = Math.max(1, Math.ceil(a.events.length / PAGE));
    state.page = Math.min(state.page, pages);
    const rows = a.events.slice((state.page - 1) * PAGE, state.page * PAGE);
    const evtPill = { Procurement: 'pill-indigo', Handover: 'pill-blue', Repair: 'pill-rose' };
    const pageBtns = [];
    for (let p = Math.max(1, state.page - 2); p <= Math.min(pages, Math.max(1, state.page - 2) + 4); p++) pageBtns.push(p);

    $('#rep-analytics', el).innerHTML = `
      <div class="grid grid-4" style="margin-bottom:20px">
        <div class="card rep-kpi">
          <div class="rep-kpi-head"><span class="rep-kpi-label">Total Active<br>Inventory</span>${iconChip('devices', 'indigo')}</div>
          <div class="rep-kpi-value">${a.totalActive.toLocaleString()}
            <span class="trend-chip up"><span class="ms">trending_up</span> +${a.purchased.length} ${rangeLabel}</span></div>
        </div>
        <div class="card rep-kpi">
          <div class="rep-kpi-head"><span class="rep-kpi-label">Avg Asset<br>Lifecycle</span>${iconChip('history_toggle_off', 'blue')}</div>
          <div class="rep-kpi-value">${a.avgLifecycle} <small>months</small>
            <span class="trend-chip flat"><span class="ms">schedule</span> avg age ${a.avgAge} mo</span></div>
        </div>
        <div class="card rep-kpi">
          <div class="rep-kpi-head"><span class="rep-kpi-label">Procurement<br>(${esc(rangeLabel)})</span>${iconChip('shopping_cart', 'emerald')}</div>
          <div class="rep-kpi-value">${a.purchased.length} <small>assets</small>
            ${a.procTrend != null ? `<span class="trend-chip ${a.procTrend >= 0 ? 'up' : 'down'}">
              <span class="ms">${a.procTrend >= 0 ? 'trending_up' : 'trending_down'}</span> ${a.procTrend >= 0 ? '+' : ''}${a.procTrend}%</span>` : ''}</div>
        </div>
        <div class="card rep-kpi">
          <div class="rep-kpi-head"><span class="rep-kpi-label">Maintenance<br>Spend</span>${iconChip('build', 'amber')}</div>
          <div class="rep-kpi-value">${a.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span class="trend-chip ${a.openRepairs ? 'down' : 'flat'}"><span class="ms">build</span> ${a.openRepairs} open</span></div>
        </div>
      </div>

      <div class="dash-grid" style="margin-bottom:20px">
        <div class="card">
          <div class="card-head"><h3 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--on-surface)">Inventory Growth</h3>
            <span class="cell-sub">cumulative fleet size, last 10 months</span></div>
          <div style="display:flex">
            <div class="bar-axis"><span>${maxG}</span><span>${Math.round(maxG / 2)}</span><span>0</span></div>
            <div class="bars" style="flex:1">${barsHtml}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--on-surface)">Asset Status</h3></div>
          <div class="donut-wrap" style="padding-top:14px">
            <svg width="190" height="190" viewBox="0 0 200 200" role="img" aria-label="Asset status distribution">
              ${segs}
              <text x="100" y="98" text-anchor="middle" font-size="26" font-weight="800" fill="#1b1b24">${totalStatus.toLocaleString()}</text>
              <text x="100" y="118" text-anchor="middle" font-size="12" fill="#777587">Total</text>
            </svg>
          </div>
          <div style="padding-bottom:12px">
            ${a.statusData.map((x) => `
            <div class="status-legend">
              <span class="sw" style="background:${x.color}"></span>${esc(x.status)}
              <strong>${Math.round((x.count / totalStatus) * 100)}%</strong>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--on-surface)">Recent Procurement &amp; Handover Trends</h3>
          <span class="cell-sub">${a.events.length} events • ${esc(rangeLabel)}</span></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Date</th><th>Event Type</th><th>Asset Model</th><th>Assigned To</th><th style="text-align:right">Value/Cost</th></tr></thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="5" class="table-empty">No events in this window.</td></tr>' :
              rows.map((e) => `
              <tr>
                <td class="mono">${toDate(e.date).toISOString().slice(0, 10)}</td>
                <td><span class="pill ${evtPill[e.type]}">${e.type}</span></td>
                <td><span class="cell-title">${esc(e.model)}</span> <span class="cell-sub mono">${esc(e.tag)}</span></td>
                <td>${esc(e.who)}</td>
                <td style="text-align:right" class="mono">${e.cost != null ? e.cost.toFixed(2) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="table-foot">
          Showing ${a.events.length === 0 ? 0 : (state.page - 1) * PAGE + 1} to ${Math.min(state.page * PAGE, a.events.length)} of ${a.events.length} entries
          <span class="spacer"></span>
          <div class="pager">
            <button data-pg="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>Prev</button>
            ${pageBtns.map((p) => `<button data-pg="${p}" class="${p === state.page ? 'on' : ''}">${p}</button>`).join('')}
            <button data-pg="${state.page + 1}" ${state.page >= pages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>`;

    $('#rep-analytics', el).querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => {
      state.page = Number(b.dataset.pg);
      renderAnalytics();
    }));
  }

  $('#rep-range', el).addEventListener('change', (e) => {
    state.range = Number(e.target.value);
    state.page = 1;
    renderAnalytics();
  });
  $('#rep-export-events', el).addEventListener('click', () => {
    const a = computeAnalytics();
    csvDownload(
      `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Event Type', 'Asset Model', 'Asset Tag', 'Assigned To', 'Cost'],
      a.events.map((e) => [toDate(e.date).toISOString().slice(0, 10), e.type, e.model, e.tag, e.who,
        e.cost != null ? e.cost.toFixed(2) : ''])
    );
    toast('Analytics report exported as CSV', 'success');
  });
  renderAnalytics();

  /* ---- custom builder wiring (unchanged behaviour) ---- */
  const srcSel = $('#crb-source', el);
  function renderBuilder() {
    const def = CUSTOM_SOURCES[srcSel.value];
    $('#crb-cols', el).innerHTML = def.columns.map(([k, label]) => `
      <label class="chip" style="cursor:pointer"><input type="checkbox" value="${k}" checked
        style="width:14px;height:14px;accent-color:var(--primary-container)"> ${esc(label)}</label>`).join('');
    $('#crb-filters', el).innerHTML = def.filters.map((f) => {
      if (f.type === 'select') {
        return `<select data-filter="${f.key}" title="${esc(f.label)}">
          ${f.options.map((o) => {
            const v = typeof o === 'object' ? o.value : o;
            const l = typeof o === 'object' ? o.label : (o === '' ? `${f.label}: all` : o);
            return `<option value="${esc(v)}">${esc(l)}</option>`;
          }).join('')}</select>`;
      }
      return `<input type="${f.type}" data-filter="${f.key}" placeholder="${esc(f.label)}" title="${esc(f.label)}">`;
    }).join('') || '<span class="cell-sub">No filters for this source.</span>';
  }
  srcSel.addEventListener('change', renderBuilder);
  renderBuilder();

  $('#crb-generate', el).addEventListener('click', async () => {
    const def = CUSTOM_SOURCES[srcSel.value];
    const slot = $('#report-result', el);
    slot.innerHTML = '<div class="table-empty">Generating custom report…</div>';
    try {
      let rows = await def.fetch();
      const activeFilters = [];
      el.querySelectorAll('#crb-filters [data-filter]').forEach((inp) => {
        const v = inp.value;
        if (v === '' || v == null) return;
        const f = def.filters.find((x) => x.key === inp.dataset.filter);
        rows = rows.filter((r) => f.apply(r, v));
        activeFilters.push(`${f.label}: ${v}`);
      });
      const selCols = def.columns.filter(([k]) =>
        el.querySelector(`#crb-cols input[value="${k}"]`).checked);
      if (selCols.length === 0) throw new Error('Select at least one column');
      showReportResult(slot, `Custom — ${def.label}`, {
        cols: selCols.map(([, label]) => label),
        rows: rows.map((r) => selCols.map(([, , get]) => get(r))),
        summary: `${rows.length} rows • ${def.label}` +
          (activeFilters.length ? ` • filters: ${activeFilters.join('; ')}` : ' • no filters'),
      });
    } catch (err) {
      slot.innerHTML = `<div class="card card-pad"><div class="form-error">${esc(err.message)}</div></div>`;
    }
  });

  /* ---- preset cards ---- */
  bindView(el, async (e) => {
    const card = e.target.closest('[data-report]'); if (!card) return;
    const def = REPORT_DEFS.find((r) => r.id === card.dataset.report);
    const slot = $('#report-result', el);
    slot.innerHTML = '<div class="table-empty">Generating report…</div>';
    try {
      showReportResult(slot, def.title, await buildReport(def.id));
    } catch (err) {
      slot.innerHTML = `<div class="card card-pad"><div class="form-error">${esc(err.message)}</div></div>`;
    }
  });
};
