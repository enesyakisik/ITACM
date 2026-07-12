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
  if (isStaleView(el)) return;
  const canEdit = Auth.can('canManageAssets');
  const PAGE = 50;
  const page = Math.max(1, Number(params.page) || 1);
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  q.set('limit', String(PAGE));
  q.set('offset', String((page - 1) * PAGE));
  const { items, total, summary } = employeeList(await api('/employees?' + q.toString()));
  if (isStaleView(el)) return;

  const withAssets = summary ? summary.withAssets : items.filter((x) => x.activeAssetCount > 0).length;
  const coverage = total ? Math.round((withAssets / total) * 1000) / 10 : 0;
  const inactive = summary ? summary.inactive : items.filter((x) => x.status === 'Inactive').length;
  const activeCount = summary ? summary.active : (total - inactive);

  el.innerHTML = `
    ${pageHead('Employee Directory', 'Manage personnel and their assigned IT assets.', canEdit ?
      `<button class="btn btn-primary" id="emp-new"><span class="ms">person_add</span> Add New Employee</button>` : '')}

    <div class="grid grid-4" style="margin-bottom:20px">
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Total Employees</h3>${iconChip('group', 'indigo')}</div>
        <div class="metric-value">${total.toLocaleString()}</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">With Active Assets</h3>${iconChip('devices', 'blue')}</div>
        <div class="metric-value">${withAssets.toLocaleString()}</div>
        <div class="metric-trend trend-flat">${coverage}% coverage</div>
      </div>
      <div class="card card-pad metric">
        <div class="metric-top"><h3 class="card-title">Active</h3>${iconChip('how_to_reg', 'emerald')}</div>
        <div class="metric-value">${activeCount.toLocaleString()}</div>
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
        <tbody id="emp-tbody"></tbody>
      </table></div>
      <div class="table-foot" id="emp-foot"></div>
    </div>`;

  /* Server-side pagination (50 rows per page). */
  const pages = Math.max(1, Math.ceil(total / PAGE));
  function renderPage() {
    const slice = items;
    $('#emp-tbody', el).innerHTML = total === 0
      ? '<tr><td colspan="6" class="table-empty">No employees found.</td></tr>'
      : slice.map((x) => `
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
        </tr>`).join('');
    const from = total ? (page - 1) * PAGE + 1 : 0;
    const to = Math.min(page * PAGE, total);
    const btns = [];
    for (let p = Math.max(1, page - 2); p <= Math.min(pages, Math.max(1, page - 2) + 4); p++) btns.push(p);
    $('#emp-foot', el).innerHTML = `Showing ${from} to ${to} of ${total.toLocaleString()} employees
      <span class="spacer"></span>
      <div class="pager">
        <button data-pg="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Prev</button>
        ${btns.map((p) => `<button data-pg="${p}" class="${p === page ? 'on' : ''}">${p}</button>`).join('')}
        <button data-pg="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>
      </div>`;
    $('#emp-foot', el).querySelectorAll('[data-pg]').forEach((b) =>
      b.addEventListener('click', () => {
        if (isStaleView(el)) return;
        location.hash = '#/employees?' + new URLSearchParams({ ...params, page: b.dataset.pg }).toString();
      }));
  }
  renderPage();

  const rerender = (p) => { if (isStaleView(el)) return; Views.employees(el, { ...params, ...p }); };
  $('#emp-search', el).addEventListener('change', (e) => rerender({ search: e.target.value, page: 1 }));
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
  const canDelDoc = Auth.can('canManageUsers');
  const [assetsRes, receipts, allSoftware, history, documents, lines] = await Promise.all([
    api(`/assets?employeeId=${encodeURIComponent(emp.id)}&status=Assigned&limit=500`),
    api(`/handovers?employeeId=${encodeURIComponent(emp.id)}&limit=20`),
    // includeRevoked so past software zimmet also shows in the history timeline.
    api(`/licenses/assignments?employeeId=${encodeURIComponent(emp.id)}&includeRevoked=true`),
    api(`/employees/${encodeURIComponent(emp.id)}/history?limit=50`).catch(() => []),
    api(`/employees/${encodeURIComponent(emp.id)}/documents`).catch(() => []),
    api(`/lines?employeeId=${encodeURIComponent(emp.id)}`).catch(() => []),
  ]);
  const assets = assetsRes.items;
  const software = allSoftware.filter((s) => !s.revokedAt); // active only, for the overview

  // Merge device + software + mobile-line events into one activity timeline.
  const swEvents = [];
  allSoftware.forEach((s) => {
    swEvents.push({ ts: s.assignedAt, type: 'software_assigned', label: s.softwareName, by: s.assignedByName, kind: 'software' });
    if (s.revokedAt) swEvents.push({ ts: s.revokedAt, type: 'software_revoked', label: s.softwareName, by: s.revokedByName || '', kind: 'software' });
  });
  const timeline = [
    ...history.map((h) => ({
      ts: h.timestamp,
      type: h.actionType,
      label: h.label || h.assetTag,
      by: h.changedByName,
      notes: h.notes,
      kind: h.kind || 'device',
    })),
    ...swEvents,
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const fmtKB = (n) => (n >= 1024 * 1024 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

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
        <button class="tab active" data-tab="overview">${esc(t('common.overview'))}</button>
        <button class="tab" data-tab="history">${esc(t('common.history'))} (${timeline.length})</button>
        <button class="tab" data-tab="documents">${esc(t('common.documents'))} (${documents.length})</button>
      </div>
      <div id="tab-overview">
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--on-surface-variant);margin:0 0 8px">
        ${esc(t('emp.assignedAssets'))} (${assets.length})</h3>
      ${assets.length === 0 ? `<div class="cell-sub" style="margin-bottom:16px">${esc(t('emp.noAssets'))}</div>` : `
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
          ${esc(t('emp.assignedSoftware'))} (${software.length})</h3>
        ${canEdit ? `<button class="btn btn-outline btn-sm" id="emp-assign-sw"><span class="ms">add</span> ${esc(t('emp.assignSoftware'))}</button>` : ''}
      </div>
      ${software.length === 0 ? `<div class="cell-sub" style="margin-bottom:16px">${esc(t('emp.noSoftware'))}</div>` : `
      <div style="margin-bottom:18px">
        ${software.map((s) => `
        <div class="history-item" style="justify-content:space-between">
          <span><span class="ms" style="color:var(--on-surface-variant);margin-right:8px">vpn_key</span>
            <strong>${esc(s.softwareName)}</strong></span>
          <span class="cell-sub">${fmtDate(s.assignedAt)} • by ${esc(s.assignedByName || '—')}</span>
          ${canEdit ? `<button class="btn btn-outline btn-sm" data-revoke-sw="${esc(s.id)}">Revoke</button>` : ''}
        </div>`).join('')}
      </div>`}

      <div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 8px">
        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--on-surface-variant);margin:0">
          ${esc(t('emp.mobileLines'))} (${lines.length})</h3>
        ${canEdit ? `<button class="btn btn-outline btn-sm" id="emp-assign-line"><span class="ms">add</span> ${esc(t('emp.assignLine'))}</button>` : ''}
      </div>
      ${lines.length === 0 ? `<div class="cell-sub" style="margin-bottom:16px">${esc(t('emp.noLines'))}</div>` : `
      <div class="table-wrap" style="margin-bottom:18px;border:1px solid var(--outline-variant);border-radius:var(--radius-lg)">
        <table class="data">
          <thead><tr><th>${esc(t('lines.phone'))}</th><th>${esc(t('lines.operator'))}</th><th>${esc(t('lines.plan'))}</th><th>${esc(t('lines.sim'))}</th>${canEdit ? '<th style="text-align:right"></th>' : ''}</tr></thead>
          <tbody>
            ${lines.map((l) => `
            <tr>
              <td class="mono cell-title">${esc(l.phoneNumber)}</td>
              <td>${esc(l.operator || '—')}</td>
              <td class="cell-sub">${esc(l.plan || '—')}</td>
              <td class="mono cell-sub">${esc(l.simSerial || '—')}</td>
              ${canEdit ? `<td class="actions">
                <button class="btn btn-outline btn-sm" data-return-line="${esc(l.id)}">
                  <span class="ms">undo</span> ${esc(t('emp.unassign'))}</button></td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}

      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--on-surface-variant);margin:0 0 8px">
        ${esc(t('emp.handoverReceipts'))} (${receipts.length})</h3>
      ${receipts.length === 0 ? '<div class="cell-sub">No handover receipts yet.</div>' :
        receipts.map((h) => `
        <div class="history-item" style="justify-content:space-between">
          <span class="when">${fmtDateTime(h.transactionDate)}</span>
          <span>${(h.items || []).length} item(s) • <span class="cell-sub">${esc(h.documentType)}</span></span>
          <button class="btn btn-outline btn-sm" data-reprint="${esc(h.id)}"><span class="ms">print</span> Reprint Form</button>
        </div>`).join('')}

      </div>
      <div id="tab-history" class="hidden">
        <div class="cell-sub" style="margin-bottom:10px">${esc(t('emp.historyHint'))}</div>
        ${timeline.length === 0 ? `<div class="table-empty">${esc(t('emp.noHistory'))}</div>` :
          `<div style="max-height:340px;overflow-y:auto">` +
          timeline.map((ev) => `
          <div class="history-item" style="flex-wrap:wrap">
            <span class="when">${fmtDateTime(ev.ts)}</span>
            <span>${ev.kind === 'software'
              ? `<span class="pill ${ev.type === 'software_revoked' ? 'pill-rose' : 'pill-indigo'}"><span class="ms ms-sm">vpn_key</span> ${esc(ev.type === 'software_revoked' ? t('emp.swRevoked') : t('emp.swAssigned'))}</span>`
              : ev.kind === 'line'
                ? `<span class="pill ${ev.type === 'line_unassigned' ? 'pill-rose' : 'pill-blue'}"><span class="ms ms-sm">sim_card</span> ${esc(ev.type === 'line_unassigned' ? t('emp.lineReturned') : t('emp.lineAssigned'))}</span>`
                : badge(ev.type)}</span>
            <span class="mono">${esc(ev.label)}</span>
            <span class="cell-sub">by ${esc(ev.by || '—')}</span>
            ${ev.notes ? `<span class="cell-sub" style="flex-basis:100%;padding-left:2px">↳ ${esc(ev.notes)}</span>` : ''}
          </div>`).join('') + '</div>'}
      </div>

      <div id="tab-documents" class="hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="cell-sub">Handover forms are auto-archived here. Upload signed/scanned copies (PDF or image).</div>
          ${canEdit ? '<button class="btn btn-primary btn-sm" id="doc-upload-btn"><span class="ms">upload_file</span> Upload scan</button>' : ''}
        </div>
        <input type="file" id="doc-file" accept="application/pdf,image/*" class="hidden">
        ${documents.length === 0 ? '<div class="table-empty">No documents yet. Execute a handover or upload a signed scan.</div>' : `
        <div class="table-wrap" style="border:1px solid var(--outline-variant);border-radius:var(--radius-lg)"><table class="data">
          <thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Added</th><th style="text-align:right"></th></tr></thead>
          <tbody>
            ${documents.map((d) => `
            <tr>
              <td><div style="display:flex;align-items:center;gap:8px">
                <span class="ms" style="color:var(--on-surface-variant)">${d.mime && d.mime.includes('pdf') ? 'picture_as_pdf' : 'image'}</span>
                <a href="#" class="cell-title doc-link" data-doc-view="${esc(d.id)}" title="Click to view">${esc(d.filename)}</a></div></td>
              <td>${d.kind === 'scan' ? '<span class="pill pill-emerald">Signed scan</span>' : '<span class="pill pill-indigo">Generated</span>'}</td>
              <td class="cell-sub">${fmtKB(d.byteSize || 0)}</td>
              <td class="cell-sub">${fmtDateTime(d.createdAt)}${d.uploadedByName ? ' • ' + esc(d.uploadedByName) : ''}</td>
              <td class="actions">
                <a class="btn btn-outline btn-sm" href="/api/documents/${esc(d.id)}/download" data-doc-dl="${esc(d.id)}"><span class="ms">download</span></a>
                ${canDelDoc ? `<button class="btn btn-outline btn-sm" data-doc-del="${esc(d.id)}"><span class="ms">delete</span></button>` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>`}
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
        $('#tab-documents', overlay).classList.toggle('hidden', tb.dataset.tab !== 'documents');
      }));

      // Click the filename → open the document in a new tab (inline view).
      overlay.querySelectorAll('[data-doc-view]').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        viewAuthed(`/api/documents/${a.dataset.docView}/download`);
      }));

      // Authenticated document download (Bearer token can't ride on a plain <a>).
      overlay.querySelectorAll('[data-doc-dl]').forEach((a) => a.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const resp = await fetch(`/api/documents/${a.dataset.docDl}/download`, { headers: { Authorization: 'Bearer ' + Auth.token } });
          if (!resp.ok) throw new Error('Download failed');
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const dl = document.createElement('a');
          dl.href = url;
          dl.download = (resp.headers.get('Content-Disposition') || '').match(/filename="(.+?)"/)?.[1] || 'document';
          dl.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err) { toast(err.message, 'error'); }
      }));

      // Upload a signed/scanned copy.
      const upBtn = $('#doc-upload-btn', overlay);
      const upFile = $('#doc-file', overlay);
      if (upBtn && upFile) {
        upBtn.addEventListener('click', () => upFile.click());
        upFile.addEventListener('change', async () => {
          const file = upFile.files[0];
          if (!file) return;
          if (file.size > 8 * 1024 * 1024) { toast('File too large — max 8MB', 'error'); return; }
          upBtn.disabled = true;
          try {
            const base64 = await new Promise((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(r.result);
              r.onerror = rej;
              r.readAsDataURL(file);
            });
            await api(`/employees/${emp.id}/documents`, {
              method: 'POST',
              body: { filename: file.name, mime: file.type || 'application/pdf', base64, employeeName: emp.fullName },
            });
            toast(`"${file.name}" uploaded to ${emp.fullName}'s archive`, 'success');
            showEmployeeDetail(emp);
          } catch (err) { toast(err.message, 'error'); upBtn.disabled = false; }
        });
      }

      // Delete an archived document.
      overlay.querySelectorAll('[data-doc-del]').forEach((b) => b.addEventListener('click', () => {
        confirmModal('Delete this archived document permanently?', async () => {
          await api('/documents/' + b.dataset.docDel, { method: 'DELETE' });
          toast('Document deleted', 'success');
          showEmployeeDetail(emp);
        });
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

      // Mobile line zimmet: assign a free Active line to this employee.
      const lineBtn = $('#emp-assign-line', overlay);
      if (lineBtn) lineBtn.addEventListener('click', async () => {
        const free = (await api('/lines?status=Active')).filter((l) => !l.currentEmployeeId);
        formModal({
          title: `Assign mobile line to ${emp.fullName}`,
          fields: [{
            name: 'lineId', label: 'Mobile line *', type: 'select', required: true, full: true,
            options: [{ value: '', label: free.length ? 'Select a line…' : 'No unassigned Active lines' },
              ...free.map((l) => ({
                value: l.id,
                label: `${l.phoneNumber}${l.operator ? ' · ' + l.operator : ''}${l.plan ? ' · ' + l.plan : ''}`,
              }))],
          }],
          submitLabel: 'Assign line',
          async onSubmit(d) {
            if (!d.lineId) throw new Error('Select a line');
            const r = await api(`/lines/${d.lineId}/assign`, { method: 'POST', body: { employeeId: emp.id } });
            toast(`${r.phoneNumber} assigned to ${r.currentEmployeeName}`, 'success');
            showEmployeeDetail(emp);
          },
        });
      });

      overlay.querySelectorAll('[data-return-line]').forEach((b) => b.addEventListener('click', () => {
        const line = lines.find((x) => x.id === b.dataset.returnLine);
        confirmModal(`Unassign ${line ? line.phoneNumber : 'this line'} from ${emp.fullName}?`, async () => {
          await api(`/lines/${b.dataset.returnLine}/unassign`, { method: 'POST' });
          toast('Mobile line returned', 'success');
          showEmployeeDetail(emp);
        });
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
            const fresh = await api(`/employees/${emp.id}`).catch(() => emp);
            showEmployeeDetail(fresh);
          },
        });
      }));
      // Reprint a past receipt exactly as it was recorded.
      overlay.querySelectorAll('[data-reprint]').forEach((b) => b.addEventListener('click', async () => {
        printHandover(await api('/handovers/' + b.dataset.reprint));
      }));
      // Regenerate a fresh Zimmet Tutanağı covering everything currently assigned
      // (devices + mobile lines).
      const cur = $('#emp-print-current', overlay);
      if (cur) cur.addEventListener('click', () => {
        const assetItems = assets.map((a) => ({
          kind: 'asset',
          assetTag: a.assetTag,
          brand: a.brand,
          model: a.model,
          category: a.category,
          serialNumber: a.serialNumber,
          macAddress: a.macEthernet || a.macWifi || null,
          conditionNote: 'In use / Kullanımda',
        }));
        const lineItems = (lines || []).map((l) => ({
          kind: 'line',
          lineId: l.id,
          phoneNumber: l.phoneNumber,
          operator: l.operator,
          plan: l.plan,
          simSerial: l.simSerial,
          conditionNote: 'In use / Kullanımda',
        }));
        printHandover({
          id: emp.id,
          employeeId: emp.id,
          employeeName: emp.fullName,
          transactionDate: new Date().toISOString(),
          documentType: 'single',
          items: [...assetItems, ...lineItems],
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
      // Departments are managed centrally in Product Catalog; keep an unknown
      // legacy value selectable so editing an old employee doesn't lose it.
      { name: 'department', label: 'Department', type: 'select', value: emp?.department || '',
        options: [{ value: '', label: '— No department —' },
          ...(emp?.department && !(AppConfig.departments || []).includes(emp.department) ? [emp.department] : []),
          ...(AppConfig.departments || [])] },
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

