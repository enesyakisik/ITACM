Views.assets = async function (el, params = {}) {
  if (isStaleView(el)) return;
  const canEdit = Auth.can('canManageAssets');
  const PAGE_SIZE = 50;
  const useLifecycle = params.lifecycle === 'overdue' || params.lifecycle === 'soon';
  const page = Math.max(1, Number(params.page) || 1);
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.category) q.set('category', params.category);
  if (params.location) q.set('location', params.location);
  if (params.search) q.set('search', params.search);
  if (useLifecycle) {
    q.set('limit', '2000');
  } else {
    q.set('limit', String(PAGE_SIZE));
    q.set('offset', String((page - 1) * PAGE_SIZE));
  }
  let [{ items, total }, stats] = await Promise.all([
    api('/assets?' + q.toString()),
    api('/dashboard/stats'),
  ]);
  if (isStaleView(el)) return;
  const a = stats.assets;

  if (useLifecycle) {
    if (params.lifecycle === 'overdue') {
      items = items.filter((x) => lifecycleInfo(x).overdue && x.status !== 'Scrap');
    } else {
      items = items.filter((x) => {
        const l = lifecycleInfo(x);
        return !l.overdue && l.pct != null && l.pct >= 90 && x.status !== 'Scrap';
      });
    }
    total = items.length;
  }

  const pages = Math.max(1, Math.ceil((useLifecycle ? items.length : total) / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageItems = useLifecycle
    ? items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : items;
  const CATS = ['Laptop', 'Desktop', 'Monitor', 'Television', 'Phone', 'Tablet', 'Printer', 'Network', 'Keyboard', 'Mouse', 'Headset', 'Docking Station', 'Webcam', 'Peripheral', 'Accessory', 'Other'];

  const chips = [];
  if (params.status) chips.push({ key: 'status', label: `Status: ${params.status}` });
  if (params.category) chips.push({ key: 'category', label: `Category: ${params.category}` });
  if (params.location) chips.push({ key: 'location', label: `Location: ${params.location}` });
  if (params.lifecycle) chips.push({ key: 'lifecycle', label: `Lifecycle: ${params.lifecycle === 'overdue' ? 'Past EOL' : 'EOL soon'}` });
  if (params.search) chips.push({ key: 'search', label: `Search: ${params.search}` });

  el.innerHTML = `
    ${pageHead('Hardware Inventory', 'Manage physical devices, laptops, and networking gear.', canEdit ? `
      <button class="btn btn-outline" id="asset-import"><span class="ms">upload_file</span> Import Excel/CSV</button>
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
      Showing ${pageItems.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to ${Math.min(safePage * PAGE_SIZE, useLifecycle ? items.length : total)}
      of ${total != null ? total : pageItems.length} assets
      <span class="spacer"></span>
      <button class="btn btn-outline btn-sm" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>‹ Prev</button>
      <span style="padding:0 6px">Page ${safePage} / ${pages}</span>
      <button class="btn btn-outline btn-sm" data-page="${safePage + 1}" ${safePage >= pages ? 'disabled' : ''}>Next ›</button>
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
        <button class="btn btn-outline btn-sm" id="bulk-labels"><span class="ms">barcode</span> Print Labels</button>
        <button class="btn btn-outline btn-sm" id="bulk-return"><span class="ms">undo</span> Return to Stock</button>
        <button class="btn btn-outline btn-sm" id="bulk-repair"><span class="ms">build</span> Send to Repair</button>
        <button class="btn btn-danger btn-sm" id="bulk-scrap"><span class="ms">delete</span> Scrap</button>
        <button class="btn btn-outline btn-sm" id="bulk-clear">Clear</button>
      </div>`;

    const pick = () => items.filter((x) => selected.has(x.id));

    $('#bulk-labels', slot).addEventListener('click', () => printAssetLabels(pick()));

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
        // Cost is entered later when each repair is closed (it isn't known yet).
        fields: [
          { name: 'serviceCompany', label: 'Service company *', required: true },
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

  const rerender = (p) => { if (isStaleView(el)) return; Views.assets(el, { ...params, ...p }); };
  $('#asset-search', el).addEventListener('change', (e) => rerender({ search: e.target.value, page: 1 }));
  $('#asset-status', el).addEventListener('change', (e) => rerender({ status: e.target.value, page: 1 }));
  $('#asset-category', el).addEventListener('change', (e) => rerender({ category: e.target.value, page: 1 }));
  $('#asset-location', el).addEventListener('change', (e) => rerender({ location: e.target.value, page: 1 }));
  if (canEdit) {
    $('#asset-new', el).addEventListener('click', () => assetForm(null, () => rerender({})));
    $('#asset-export', el).addEventListener('click', () => exportCsv(items));
    $('#asset-import', el).addEventListener('click', () => showImportModal(() => rerender({})));
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
        // Cost is intentionally NOT collected here — the repair bill is only known
        // later. It is entered when the repair is closed (Maintenance → Close).
        fields: [
          { name: 'serviceCompany', label: 'Service company', required: true },
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
  const CATS = ['Laptop', 'Desktop', 'Monitor', 'Television', 'Phone', 'Tablet', 'Printer', 'Network', 'Keyboard', 'Mouse', 'Headset', 'Docking Station', 'Webcam', 'Peripheral', 'Accessory', 'Other'];
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
        <div class="form-field"><label>Lifecycle override (months) <span class="ob-hint">(blank = category default, e.g. Mac = 60)</span></label>
          <input type="number" name="lifecycleMonths" min="1" max="240" placeholder="Category default"
            value="${asset && asset.lifecycleMonths != null ? asset.lifecycleMonths : ''}"></div>
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
        Television: ['macEthernet', 'macWifi'],
        Printer: ['macEthernet', 'macWifi'],
        Network: ['macEthernet'],
        Keyboard: [], Mouse: [], Headset: [], Webcam: [],
        'Docking Station': ['macEthernet'],
        Peripheral: [], Accessory: [],
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
          lifecycleMonths: f.lifecycleMonths.value ? Number(f.lifecycleMonths.value) : null,
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
  const [x, repairs, repairDocs] = await Promise.all([
    api(`/assets/${id}`),
    api(`/maintenance?assetId=${encodeURIComponent(id)}`).catch(() => []), // Viewer role → 403 → []
    api(`/maintenance/asset/${encodeURIComponent(id)}/documents`).catch(() => []),
  ]);
  const docsByLog = {};
  repairDocs.forEach((d) => { (docsByLog[d.maintenanceId] = docsByLog[d.maintenanceId] || []).push(d); });
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
        }).join('')}
      <h3 style="font-size:11px;text-transform:uppercase;color:var(--on-surface-variant);margin:18px 0 6px">
        Repair &amp; Maintenance (${repairs.length})</h3>
      ${repairs.length === 0 ? '<div class="cell-sub">No repair records for this device.</div>' :
        repairs.map((m) => {
          const notes = (m.progressNotes || []).map((n) => (typeof n === 'string' ? n : n.note)).filter(Boolean);
          return `
          <div class="history-item" style="flex-wrap:wrap;gap:6px 12px">
            <span class="when">${fmtDate(m.sentDate)}${m.returnDate ? ' → ' + fmtDate(m.returnDate) : ''}</span>
            <span class="pill ${m.returnDate ? 'pill-emerald' : 'pill-amber'}">${m.returnDate ? 'Repaired' : 'In Repair'}</span>
            <span><span class="ms ms-sm" style="color:var(--on-surface-variant);margin-right:4px">build</span><strong>${esc(m.serviceCompany)}</strong></span>
            <span class="cell-sub">${esc(m.issueDescription)}</span>
            <span style="margin-left:auto" class="cell-sub">Cost: <strong>${Number(m.cost || 0).toFixed(2)}</strong></span>
            ${m.resolutionNote ? `<span class="cell-sub" style="flex-basis:100%;padding-left:2px">↳ Resolution: ${esc(m.resolutionNote)}</span>` : ''}
            ${notes.length ? `<span class="cell-sub" style="flex-basis:100%;padding-left:2px">↳ Notes: ${notes.map((n) => esc(n)).join(' · ')}</span>` : ''}
            ${(docsByLog[m.id] || []).length ? `<span class="cell-sub" style="flex-basis:100%;padding-left:2px">
              <span class="ms ms-sm" style="vertical-align:-2px">attach_file</span> ${(docsByLog[m.id] || []).map((d) =>
                `<a href="#" data-mdoc-dl="${esc(d.id)}" style="color:var(--primary)">${esc(d.filename)}</a>`).join(' · ')}</span>` : ''}
          </div>`;
        }).join('')}`,
    foot: `
      <button class="btn btn-outline" data-close>Close</button>
      <button class="btn btn-outline" id="ad-qr"><span class="ms">qr_code_2</span> QR</button>
      <button class="btn btn-outline" id="ad-label"><span class="ms">barcode</span> Label</button>
      ${canEdit ? `
        <button class="btn btn-outline" id="ad-edit"><span class="ms">edit</span> Edit</button>
        ${x.status === 'Assigned' ? '<button class="btn btn-outline" id="ad-return"><span class="ms">undo</span> Return</button>' : ''}
        ${x.status === 'In Stock' || x.status === 'Assigned' ? '<button class="btn btn-primary" id="ad-repair"><span class="ms">build</span> Repair</button>' : ''}
        ${x.status === 'In Stock' ? '<button class="btn btn-primary" id="ad-handover"><span class="ms">assignment_turned_in</span> Handover</button>' : ''}` : ''}`,
    onMount(overlay) {
      $('#ad-qr', overlay).addEventListener('click', () => showQrModal(x));
      $('#ad-label', overlay).addEventListener('click', () => printAssetLabels([x]));
      // Attached repair paperwork: click → view inline in a new tab.
      overlay.querySelectorAll('[data-mdoc-dl]').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        viewAuthed(`/api/maintenance/documents/${a.dataset.mdocDl}/download`);
      }));
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
        // Cost is entered later when the repair is closed (it isn't known yet).
        fields: [
          { name: 'serviceCompany', label: 'Service company *', required: true },
          { name: 'issueDescription', label: 'Issue description *', type: 'textarea', required: true, full: true },
