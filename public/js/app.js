/*
 * App bootstrap: onboarding, branding, hash router, topbar, session lifecycle.
 * XSS policy: innerHTML templates below contain only trusted static markup
 * plus esc()-encoded values (see ui.js).
 */
'use strict';

const ROUTES = {
  '#/dashboard': { title: 'Dashboard', view: 'dashboard', icon: 'dashboard' },
  '#/assets': { title: 'Hardware', view: 'assets', icon: 'devices' },
  '#/catalog': { title: 'Product Catalog', view: 'catalog', icon: 'category' },
  '#/licenses': { title: 'Software & Licenses', view: 'licenses', icon: 'workspace_premium' },
  '#/consumables': { title: 'Consumables', view: 'consumables', icon: 'inventory_2' },
  '#/employees': { title: 'Employees', view: 'employees', icon: 'badge' },
  '#/handover': { title: 'Handover Ops', view: 'handover', icon: 'assignment_turned_in' },
  '#/maintenance': { title: 'Maintenance & Repair', view: 'maintenance', icon: 'build' },
  '#/reports': { title: 'Reports', view: 'reports', icon: 'summarize' },
  '#/users': { title: 'IT Users', view: 'users', icon: 'vpn_key', perm: 'canManageUsers' },
};

function renderNav() {
  $('#nav').innerHTML = Object.entries(ROUTES)
    .filter(([, r]) => !r.perm || Auth.can(r.perm))
    .map(([hash, r]) =>
      `<a href="${hash}" data-route="${hash}"><span class="ms">${r.icon}</span> ${esc(r.title)}</a>`)
    .join('');
}

async function navigate() {
  // Support query params in the hash, e.g. #/assets?lifecycle=overdue
  const [rawHash, rawQuery] = location.hash.split('?');
  const hash = ROUTES[rawHash] ? rawHash : '#/dashboard';
  const route = ROUTES[hash];
  const params = Object.fromEntries(new URLSearchParams(rawQuery || ''));
  if (route.perm && !Auth.can(route.perm)) { location.hash = '#/dashboard'; return; }

  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === hash));

  const view = $('#view');
  if (view._viewAbort) view._viewAbort.abort(); // drop stale delegated listeners
  view.innerHTML = '<div class="table-empty">Loading…</div>';
  try {
    await Views[route.view](view, params);
  } catch (err) {
    view.innerHTML = `<div class="card card-pad"><div class="form-error">${esc(err.message)}</div></div>`;
  }
}

/* ---- branding (company name + logo, used in UI and print forms) ---- */
function applyBranding() {
  const name = AppConfig.companyName || 'AssetControl';
  document.title = `${name} — IT Asset Control`;
  $$('[data-brand-name]').forEach((el) => { el.textContent = name; });
  $$('[data-brand-logo]').forEach((el) => {
    el.innerHTML = AppConfig.companyLogo
      ? `<img src="${esc(AppConfig.companyLogo)}" alt="logo">`
      : '<span class="ms">inventory_2</span>';
  });
}

/* ---- screens ---- */
function showApp() {
  $('#onboarding-screen').classList.add('hidden');
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const name = Auth.profile.username || Auth.profile.email;
  $('#user-name').textContent = name;
  $('#user-role').textContent = Auth.profile.role;
  $('#user-avatar').textContent = initials(name);
  $('#topbar-avatar').textContent = initials(name);
  $('#sidebar-new-asset').style.display = Auth.can('canManageAssets') ? '' : 'none';
  applyBranding();
  renderNav();
  navigate();
}

function showLogin() {
  $('#app').classList.add('hidden');
  $('#onboarding-screen').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
  applyBranding();
  $('#login-mode-note').textContent = 'IT Asset Control Pro';
  showConfigError('#login-error');
}

// Surface a server configuration problem (e.g. database unreachable) so the
// user sees the real issue instead of a blank screen.
function showConfigError(targetSel) {
  const box = $(targetSel);
  if (!box) return;
  if (AppConfig.configError) {
    box.textContent = '⚠ ' + AppConfig.configError;
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

function showOnboarding() {
  $('#app').classList.add('hidden');
  $('#login-screen').classList.add('hidden');
  $('#onboarding-screen').classList.remove('hidden');
  showConfigError('#onboarding-error');
}

/* ---- onboarding ---- */
let obLogoDataUrl = null;

// Guided feature tour shown before the setup form.
const OB_TOUR = [
  {
    badge: 'Welcome', icon: 'inventory_2',
    title: 'Welcome to AssetControl',
    desc: 'A complete IT asset management platform — hardware, software, handovers, maintenance and reporting, with a built-in web UI. Here\'s a quick tour of what you can do.',
    bullets: ['Self-hosted & secure', 'Works out of the box', 'No spreadsheets ever again'],
  },
  {
    badge: 'Feature 1', icon: 'devices',
    title: 'Hardware Inventory',
    desc: 'Track every device with rich detail and powerful filters.',
    bullets: [
      'Auto-assigned sequential asset tags with scannable QR codes',
      'Category-aware fields, CPU/RAM/Storage from managed lists',
      'Locations, purchase date & per-category lifecycle (EOL) tracking',
      'Bulk actions, pagination and global search',
    ],
  },
  {
    badge: 'Feature 2', icon: 'assignment_turned_in',
    title: 'Handover & Return',
    desc: 'Assign devices to employees in one atomic transaction and generate the paperwork instantly.',
    bullets: [
      'Zimmet basket → single-page printable / PDF Zimmet Tutanağı',
      'Delivery AND return signature sections on the same form',
      'Return devices to stock; every step is audited',
    ],
  },
  {
    badge: 'Feature 3', icon: 'folder_shared',
    title: 'Document Archive',
    desc: 'Every handover form is filed automatically, per employee.',
    bullets: [
      'Generated PDFs stored against each person',
      'Upload signed / scanned copies (PDF or image)',
      'Kept securely in your database — access-controlled',
    ],
  },
  {
    badge: 'Feature 4', icon: 'workspace_premium',
    title: 'Software & Licenses',
    desc: 'Manage license pools and assign software to people.',
    bullets: [
      'Seat pools with atomic claim / release',
      'Per-employee software zimmet (assign / revoke)',
      '30-day expiry alerts on the dashboard',
    ],
  },
  {
    badge: 'Feature 5', icon: 'build',
    title: 'Maintenance & Repair',
    desc: 'Full repair lifecycle with a clear paper trail.',
    bullets: [
      'Send to repair / return / scrap with state restore',
      'Add progress notes while a device is in service',
      'Everything flows into the device history',
    ],
  },
  {
    badge: 'Feature 6', icon: 'summarize',
    title: 'Reports & Analytics',
    desc: 'Understand your fleet at a glance and export anything.',
    bullets: [
      'KPI dashboard, inventory growth & status charts',
      'Custom report builder — 7 sources × columns × filters',
      'Excel-friendly CSV export and letterhead printing',
    ],
  },
  {
    badge: 'Feature 7', icon: 'verified_user',
    title: 'Roles & Security',
    desc: 'Fine-grained access with a full audit trail.',
    bullets: [
      'Owner / Admin / Helpdesk / Viewer roles',
      'Who-did-what audit log + per-user login history',
      'CSP, rate-limiting and hardened by default',
    ],
  },
];

let obStep = 0;

function renderTour() {
  const total = OB_TOUR.length + 1; // +1 for the setup step
  $('#ob-bar').style.width = `${(obStep / (total - 1)) * 100}%`;
  $('#ob-skip').style.display = obStep === OB_TOUR.length ? 'none' : '';

  const setup = $('#ob-setup');
  const tour = $('#ob-tour');
  if (obStep >= OB_TOUR.length) { // final step → form
    tour.classList.add('hidden');
    setup.classList.remove('hidden');
    return;
  }
  setup.classList.add('hidden');
  tour.classList.remove('hidden');

  const s = OB_TOUR[obStep];
  const last = obStep === OB_TOUR.length - 1;
  tour.innerHTML = `
    <div class="ob-slide">
      <span class="ob-slide-badge"><span class="ms ms-sm">auto_awesome</span> ${esc(s.badge)}</span>
      <div class="ob-slide-icon"><span class="ms">${s.icon}</span></div>
      <h2 class="ob-slide-title">${esc(s.title)}</h2>
      <p class="ob-slide-desc">${esc(s.desc)}</p>
      <ul class="ob-bullets">
        ${s.bullets.map((b) => `<li><span class="ms">check_circle</span> ${esc(b)}</li>`).join('')}
      </ul>
      <div class="ob-dots">
        ${OB_TOUR.map((_, i) => `<span class="${i === obStep ? 'on' : ''}" data-dot="${i}"></span>`).join('')}
      </div>
      <div class="ob-nav">
        <button type="button" class="btn btn-outline" id="ob-back" ${obStep === 0 ? 'disabled' : ''}>
          <span class="ms">arrow_back</span> Back</button>
        <button type="button" class="btn btn-primary" id="ob-next">
          ${last ? 'Set up your workspace' : 'Next'} <span class="ms">arrow_forward</span></button>
      </div>
    </div>`;

  $('#ob-back', tour).addEventListener('click', () => { if (obStep > 0) { obStep--; renderTour(); } });
  $('#ob-next', tour).addEventListener('click', () => { obStep++; renderTour(); });
  tour.querySelectorAll('[data-dot]').forEach((d) =>
    d.addEventListener('click', () => { obStep = Number(d.dataset.dot); renderTour(); }));
}

function bindOnboarding() {
  const form = $('#onboarding-form');

  // Feature tour navigation
  obStep = 0;
  renderTour();
  $('#ob-skip').addEventListener('click', () => { obStep = OB_TOUR.length; renderTour(); });
  $('#ob-form-back').addEventListener('click', () => { obStep = OB_TOUR.length - 1; renderTour(); });

  form.elements.logoFile.addEventListener('change', () => {
    const file = form.elements.logoFile.files[0];
    obLogoDataUrl = null;
    const preview = $('#ob-logo-preview');
    preview.classList.add('hidden');
    if (!file) return;
    if (file.size > 300 * 1024) {
      toast('Logo too large — keep it under 300KB', 'error');
      form.elements.logoFile.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      obLogoDataUrl = reader.result;
      preview.innerHTML = `<img src="${esc(obLogoDataUrl)}" alt="logo preview">`;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#onboarding-btn');
    const errBox = $('#onboarding-error');
    errBox.classList.add('hidden');
    btn.disabled = true;
    try {
      const body = {
        companyName: form.elements.companyName.value.trim(),
        companyLogo: obLogoDataUrl,
        adminUsername: form.elements.adminUsername.value.trim(),
        adminEmail: form.elements.adminEmail.value.trim(),
        adminPassword: form.elements.adminPassword.value,
      };
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.error || 'Setup failed');

      await loadAppConfig();
      toast(`Welcome, ${body.companyName}! Sign in with your new Admin account.`, 'success');
      $('#login-form').elements.email.value = body.adminEmail;
      showLogin();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---- topbar: global cross-entity search ---- */
async function globalSearch(qText) {
  const needle = qText.trim();
  if (!needle) return;
  const low = needle.toLowerCase();

  const [assetsRes, employees, licenses] = await Promise.all([
    api(`/assets?search=${encodeURIComponent(needle)}&limit=50`).catch(() => ({ items: [] })),
    api(`/employees?search=${encodeURIComponent(needle)}&limit=1000`).catch(() => []),
    api('/licenses').catch(() => []),
  ]);
  const assets = assetsRes.items.slice(0, 8);
  const emps = employees.slice(0, 8);
  const lics = licenses.filter((l) =>
    [l.softwareName, l.vendor, l.licenseKey].filter(Boolean).some((v) => String(v).toLowerCase().includes(low))
  ).slice(0, 5);

  openModal({
    title: `Search results — “${needle}”`,
    wide: true,
    body: (assets.length + emps.length + lics.length === 0)
      ? '<div class="table-empty">No matches in hardware, employees, or software.</div>'
      : `
      ${assets.length ? `<div class="gs-section">Hardware (${assets.length})</div>` +
        assets.map((a) => `
        <div class="gs-item" data-gs-asset="${esc(a.id)}">
          <span class="ms">${catIcon(a.category)}</span>
          <div style="flex:1"><strong>${esc(a.brand)} ${esc(a.model)}</strong>
            <span class="cell-sub mono">${esc(a.assetTag)} · ${esc(a.serialNumber)}</span></div>
          ${badge(a.status)}
        </div>`).join('') : ''}
      ${emps.length ? `<div class="gs-section">Employees (${emps.length})</div>` +
        emps.map((p) => `
        <div class="gs-item" data-gs-emp="${esc(p.id)}">
          <span class="avatar" style="width:28px;height:28px;font-size:11px">${esc(initials(p.fullName))}</span>
          <div style="flex:1"><strong>${esc(p.fullName)}</strong>
            <span class="cell-sub">${esc(p.department || '—')} · ${esc(p.email)}</span></div>
          <span class="badge-count ${p.activeAssetCount ? '' : 'zero'}">${p.activeAssetCount}</span>
        </div>`).join('') : ''}
      ${lics.length ? `<div class="gs-section">Software (${lics.length})</div>` +
        lics.map((l) => `
        <div class="gs-item" data-gs-lic>
          <span class="ms">vpn_key</span>
          <div style="flex:1"><strong>${esc(l.softwareName)}</strong>
            <span class="cell-sub">${l.usedSeats}/${l.totalSeats} seats</span></div>
        </div>`).join('') : ''}`,
    foot: '<button class="btn btn-outline" data-close>Close</button>',
    onMount(overlay) {
      overlay.querySelectorAll('[data-gs-asset]').forEach((it) => it.addEventListener('click', () => {
        closeModal(); showAssetDetail(it.dataset.gsAsset);
      }));
      overlay.querySelectorAll('[data-gs-emp]').forEach((it) => it.addEventListener('click', () => {
        closeModal();
        const emp = employees.find((p) => p.id === it.dataset.gsEmp);
        showEmployeeDetail(emp);
      }));
      overlay.querySelectorAll('[data-gs-lic]').forEach((it) => it.addEventListener('click', () => {
        closeModal(); location.hash = '#/licenses';
      }));
    },
  });
}

/* ---- topbar buttons: notifications / help / settings / profile ---- */
async function showNotifications() {
  const d = await api('/dashboard/stats');
  const items = [
    ...d.alerts.expiringLicenses.map((l) => ({
      icon: 'vpn_key', tone: l.daysLeft <= 7 ? 'rose' : 'amber',
      text: `${l.softwareName} expires in ${l.daysLeft} days`, go: '#/licenses',
    })),
    ...d.alerts.lowStockConsumables.map((c) => ({
      icon: 'inventory_2', tone: 'rose',
      text: `${c.itemName} is low on stock (${c.totalStock}/min ${c.minimumStockAlertLevel})`, go: '#/consumables',
    })),
    ...(d.assets.inRepair > 0 ? [{
      icon: 'build', tone: 'amber',
      text: `${d.assets.inRepair} device(s) currently in repair`, go: '#/maintenance',
    }] : []),
  ];
  openModal({
    title: `Notifications (${items.length})`,
    body: items.length === 0 ? '<div class="table-empty">All clear — no active alerts. 🎉</div>' :
      items.map((n, i) => `
      <div class="gs-item" data-note="${i}">
        ${iconChip(n.icon, n.tone)}
        <div style="flex:1">${esc(n.text)}</div>
        <span class="ms">chevron_right</span>
      </div>`).join(''),
    foot: '<button class="btn btn-outline" data-close>Close</button>',
    onMount(overlay) {
      overlay.querySelectorAll('[data-note]').forEach((it) => it.addEventListener('click', () => {
        closeModal(); location.hash = items[Number(it.dataset.note)].go;
      }));
    },
  });
}

function showHelp() {
  openModal({
    title: 'Help & shortcuts',
    body: `
      <div class="gs-section">Keyboard</div>
      <div class="gs-item"><span class="ms">keyboard_command_key</span><div style="flex:1">Focus global search</div><code>Cmd/Ctrl + K</code></div>
      <div class="gs-section">Roles</div>
      <div class="gs-item">${badge('Admin')}<div style="flex:1">Everything, incl. IT user &amp; settings management</div></div>
      <div class="gs-item">${badge('Helpdesk')}<div style="flex:1">Manage assets, handovers, repairs, software zimmet</div></div>
      <div class="gs-item">${badge('Viewer')}<div style="flex:1">Read-only access to inventory and dashboards</div></div>
      <div class="gs-section">About</div>
      <div class="cell-sub">ITACM — IT Asset Control Pro. Backend: ${esc(AppConfig.backend)}.
        Handovers, seat allocations and stock movements are fully transactional with an audit trail.</div>`,
    foot: '<button class="btn btn-outline" data-close>Close</button>',
  });
}

function showSettings() {
  if (!Auth.can('canManageBranding')) {
    toast('Only the Owner can change company & branding settings', 'error');
    return;
  }
  let newLogo = null;
  const ds = AppConfig.documentStorage || { provider: 'local' };
  const provField = (id, label, val) =>
    `<div class="form-field" style="margin-top:8px"><label>${label}</label>
       <input id="${id}" value="${esc(val || '')}" placeholder="https://…"></div>`;

  openModal({
    title: 'Company & branding settings',
    wide: true,
    body: `
      <span class="draft-chip" style="background:var(--rose-100);color:var(--rose-800)">Owner only</span>
      <div class="form-grid" style="margin-top:14px">
        <div class="form-field">
          <label>Company name</label>
          <input id="set-company" value="${esc(AppConfig.companyName || '')}" maxlength="80">
        </div>
        <div class="form-field">
          <label>Company logo (PNG/JPG/SVG, max ~300KB)</label>
          <input type="file" id="set-logo" accept="image/*">
          <div id="set-logo-preview" style="margin-top:8px">
            ${AppConfig.companyLogo ? `<img src="${esc(AppConfig.companyLogo)}" style="max-height:40px;border:1px solid var(--outline-variant);border-radius:4px;padding:4px">` : '<span class="cell-sub">No logo set.</span>'}
          </div>
        </div>
        <div class="form-field full">
          <label>Handover form terms — printed on every Zimmet Tutanağı.
            <span class="ob-hint">Separate paragraphs with a blank line; the 2nd paragraph renders italic (TR translation).</span></label>
          <textarea id="set-terms" rows="6">${esc(AppConfig.handoverTerms || '')}</textarea>
        </div>
      </div>

      <div class="gs-section" style="margin:18px 0 6px">Handover Document Storage</div>
      <p class="cell-sub" style="margin:0 0 10px">Where signed handover forms are archived. <strong>Local</strong> keeps them
        in your database (access-controlled, covered by backups). SharePoint / Google Drive route copies to your organization's
        secure cloud folder.</p>
      <div class="form-field">
        <label>Storage provider</label>
        <select id="set-storage">
          <option value="local" ${ds.provider === 'local' ? 'selected' : ''}>Local (secure, in-database) — recommended</option>
          <option value="sharepoint" ${ds.provider === 'sharepoint' ? 'selected' : ''}>Microsoft SharePoint / OneDrive</option>
          <option value="gdrive" ${ds.provider === 'gdrive' ? 'selected' : ''}>Google Drive</option>
        </select>
      </div>
      <div id="set-storage-extra">${ds.provider && ds.provider !== 'local'
        ? provField('set-folder', 'Destination folder URL', ds.folderUrl) : ''}</div>`,
    foot: `<button class="btn btn-outline" data-close>Cancel</button>
           <button class="btn btn-primary" id="set-save">Save settings</button>`,
    onMount(overlay) {
      $('#set-logo', overlay).addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 300 * 1024) { toast('Logo too large — max 300KB', 'error'); e.target.value = ''; return; }
        const r = new FileReader();
        r.onload = () => {
          newLogo = r.result;
          $('#set-logo-preview', overlay).innerHTML =
            `<img src="${esc(newLogo)}" style="max-height:40px;border:1px solid var(--outline-variant);border-radius:4px;padding:4px">`;
        };
        r.readAsDataURL(file);
      });
      $('#set-storage', overlay).addEventListener('change', (e) => {
        const v = e.target.value;
        $('#set-storage-extra', overlay).innerHTML = v === 'local' ? ''
          : provField('set-folder', 'Destination folder URL', (AppConfig.documentStorage || {}).folderUrl)
            + `<p class="cell-sub" style="margin-top:6px"><span class="ms ms-sm">lock</span> Cloud sync uses your organization's
               ${v === 'sharepoint' ? 'SharePoint' : 'Google Drive'} connector; the folder link is stored, credentials are never kept in the app.</p>`;
      });
      $('#set-save', overlay).addEventListener('click', async () => {
        try {
          const provider = $('#set-storage', overlay).value;
          const documentStorage = { provider };
          const folder = $('#set-folder', overlay);
          if (provider !== 'local' && folder) documentStorage.folderUrl = folder.value.trim();
          const saved = await api('/settings', {
            method: 'PUT',
            body: {
              companyName: $('#set-company', overlay).value.trim(),
              companyLogo: newLogo || undefined,
              handoverTerms: $('#set-terms', overlay).value,
              documentStorage,
            },
          });
          AppConfig.companyName = saved.companyName;
          AppConfig.companyLogo = saved.companyLogo;
          AppConfig.handoverTerms = saved.handoverTerms;
          AppConfig.documentStorage = saved.documentStorage;
          applyBranding();
          toast('Settings saved', 'success');
          closeModal();
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

function showProfile() {
  const p = Auth.profile;
  openModal({
    title: 'My profile',
    body: `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <span class="avatar" style="width:48px;height:48px;font-size:16px">${esc(initials(p.username || p.email))}</span>
        <div>
          <div class="cell-title" style="font-size:16px">${esc(p.username || '—')}</div>
          <div class="cell-sub">${esc(p.email)}</div>
        </div>
        <span style="margin-left:auto">${badge(p.role)}</span>
      </div>
      <div class="cell-sub">Backend: ${esc(AppConfig.backend)} • Company: ${esc(AppConfig.companyName || '—')}</div>`,
    foot: `<button class="btn btn-outline" data-close>Close</button>
           <button class="btn btn-danger" id="profile-logout"><span class="ms">logout</span> Sign out</button>`,
    onMount(overlay) {
      $('#profile-logout', overlay).addEventListener('click', () => { closeModal(); logout(); });
    },
  });
}

/* ---- init ---- */
async function init() {
  await loadAppConfig();
  applyBranding();
  bindOnboarding();

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    const errBox = $('#login-error');
    errBox.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const email = e.target.elements.email.value.trim();
      const password = e.target.elements.password.value;
      await loginWithPassword(email, password);
      showApp();
    } catch (err) {
      errBox.textContent = err.message; // textContent — no markup interpretation
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  $('#logout-btn').addEventListener('click', () => logout());
  window.addEventListener('itacm:logout', showLogin);
  window.addEventListener('hashchange', () => { if (Auth.profile) navigate(); });

  // Sidebar "+ New Asset" shortcut → Hardware view with the create modal open.
  $('#sidebar-new-asset').addEventListener('click', async () => {
    if (location.hash !== '#/assets') {
      location.hash = '#/assets';
      await new Promise((r) => setTimeout(r, 400)); // let the view render
    }
    const btn = $('#asset-new');
    if (btn) btn.click();
  });

  // Topbar buttons
  $('#btn-notifications').addEventListener('click', () => { if (Auth.profile) showNotifications().catch((e2) => toast(e2.message, 'error')); });
  $('#btn-help').addEventListener('click', showHelp);
  $('#btn-settings').addEventListener('click', () => { if (Auth.profile) showSettings(); });
  $('#topbar-avatar').addEventListener('click', () => { if (Auth.profile) showProfile(); });

  // Global search: searches hardware + employees + software together.
  const gs = $('#global-search');
  gs.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && Auth.profile) globalSearch(gs.value).catch((e2) => toast(e2.message, 'error'));
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      gs.focus();
    }
  });

  // First run → onboarding wizard.
  if (AppConfig.onboarded === false) {
    showOnboarding();
    return;
  }

  // Resume session if a token is stored and still valid.
  if (Auth.token) {
    try {
      const profile = await api('/auth/verify-token', { method: 'POST' });
      Auth.save(Auth.token, profile);
      showApp();
      return;
    } catch { Auth.clear(); }
  }
  showLogin();
}

init();
