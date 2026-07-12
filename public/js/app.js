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
  '#/lines': { title: 'Mobile Lines', view: 'lines', icon: 'sim_card' },
  '#/consumables': { title: 'Consumables', view: 'consumables', icon: 'inventory_2' },
  '#/employees': { title: 'Employees', view: 'employees', icon: 'badge' },
  '#/handover': { title: 'Handover Ops', view: 'handover', icon: 'assignment_turned_in' },
  '#/maintenance': { title: 'Maintenance & Repair', view: 'maintenance', icon: 'build' },
  '#/stockcount': { title: 'Stock Count', view: 'stockcount', icon: 'fact_check' },
  '#/reports': { title: 'Reports', view: 'reports', icon: 'summarize' },
  '#/users': { title: 'IT Users', view: 'users', icon: 'vpn_key', perm: 'canManageUsers' },
};

function renderNav() {
  // Nav labels come from the i18n dictionary. Prefer nav.<view>, then fall back
  // to a few aliases where the route view name ≠ the historical nav key.
  const NAV_KEY_ALIAS = { assets: 'hardware', licenses: 'software' };
  const label = (r) => {
    const primary = 'nav.' + r.view;
    const alias = NAV_KEY_ALIAS[r.view] ? 'nav.' + NAV_KEY_ALIAS[r.view] : null;
    const v = t(primary);
    if (v !== primary) return v;
    if (alias) {
      const a = t(alias);
      if (a !== alias) return a;
    }
    return r.title;
  };
  $('#nav').innerHTML = Object.entries(ROUTES)
    .filter(([, r]) => !r.perm || Auth.can(r.perm))
    .map(([hash, r]) =>
      `<a href="${hash}" data-route="${hash}"><span class="ms">${r.icon}</span> ${esc(label(r))}</a>`)
    .join('');
}

async function navigate() {
  closeNav();
  // Support query params in the hash, e.g. #/assets?lifecycle=overdue
  const [rawHash, rawQuery] = location.hash.split('?');
  const hash = ROUTES[rawHash] ? rawHash : '#/dashboard';
  const route = ROUTES[hash];
  const params = Object.fromEntries(new URLSearchParams(rawQuery || ''));
  if (route.perm && !Auth.can(route.perm)) { location.hash = '#/dashboard'; return; }

  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === hash));

  const view = $('#view');
  if (view._viewAbort) view._viewAbort.abort(); // drop stale delegated listeners
  view.innerHTML = `<div class="table-empty">${esc(t('common.loading'))}</div>`;
  try {
    await Views[route.view](view, params);
  } catch (err) {
    view.innerHTML = `<div class="card card-pad"><div class="form-error">${esc(err.message)}</div></div>`;
  }
  renderPageTip();
}

function openNav() {
  document.body.classList.add('nav-open');
  const backdrop = $('#sidebar-backdrop');
  if (backdrop) backdrop.hidden = false;
}
function closeNav() {
  document.body.classList.remove('nav-open');
  const backdrop = $('#sidebar-backdrop');
  if (backdrop) backdrop.hidden = true;
}
function toggleNav() {
  if (document.body.classList.contains('nav-open')) closeNav();
  else openNav();
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
  navigate().then(() => {
    if (localStorage.getItem('itacm_tips_pending') === '1') {
      localStorage.removeItem('itacm_tips_pending');
      setTimeout(() => {
        openModal({
          title: 'Quick start tips',
          body: `
            <p class="ob-slide-desc">Your workspace is ready. Want a short guided tour of the sidebar, plus lightbulb tips on each page?</p>
            <ul class="ob-bullets">
              <li><span class="ms">check_circle</span> Page tips appear under the top bar</li>
              <li><span class="ms">check_circle</span> Help (?) → replay the product intro anytime</li>
              <li><span class="ms">check_circle</span> Turn tips off with one click on the banner</li>
            </ul>`,
          foot: `<button class="btn btn-outline" id="tips-later" data-close>Maybe later</button>
                 <button class="btn btn-primary" id="tips-start"><span class="ms">tour</span> Start sidebar tour</button>`,
          onMount(overlay) {
            $('#tips-later', overlay).addEventListener('click', () => setTipsEnabled(true));
            $('#tips-start', overlay).addEventListener('click', () => {
              closeModal();
              setTipsEnabled(true);
              startUiTour();
            });
          },
        });
      }, 500);
    }
  });
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
/** Visual zimmet designs (mirrors server HANDOVER_DESIGNS). */
const HANDOVER_DESIGN_CATALOG = [
  {
    id: 'terminal', name: 'Terminal Protocol',
    desc: 'Dark navy header, violet accents — modern IT look',
    swatches: ['#131b2e', '#3525cd', '#e2dfff'],
  },
  {
    id: 'classic', name: 'Classic Formal',
    desc: 'Black & white corporate document — formal print look',
    swatches: ['#111111', '#ffffff', '#e8e8e8'],
  },
  {
    id: 'corporate', name: 'Corporate Blue',
    desc: 'Steel-blue header and calm blue accents',
    swatches: ['#1e3a5f', '#2b6cb0', '#ebf4ff'],
  },
  {
    id: 'slate', name: 'Slate Teal',
    desc: 'Teal accents on a soft slate header',
    swatches: ['#1a2e2a', '#0d9488', '#ccfbf1'],
  },
];

let obDefaultTplId = 'terminal';

function designSwatchesHtml(swatches) {
  return `<span class="ob-tpl-swatches">${(swatches || []).map((c) =>
    `<i style="background:${esc(c)};border:1px solid rgba(0,0,0,.12)"></i>`).join('')}</span>`;
}

function renderObTplCards() {
  const box = $('#ob-tpl-cards');
  if (!box) return;
  box.innerHTML = HANDOVER_DESIGN_CATALOG.map((p) => `
    <label class="ob-tpl-card ${obDefaultTplId === p.id ? 'selected' : ''}">
      <input type="radio" name="obTpl" value="${esc(p.id)}" ${obDefaultTplId === p.id ? 'checked' : ''}>
      <span class="ob-tpl-card-body">
        <strong>${esc(p.name)} ${designSwatchesHtml(p.swatches)}</strong>
        <span>${esc(p.desc)}</span>
      </span>
    </label>`).join('');
  box.querySelectorAll('input[name="obTpl"]').forEach((inp) => {
    inp.addEventListener('change', () => {
      obDefaultTplId = inp.value;
      box.querySelectorAll('.ob-tpl-card').forEach((c) => c.classList.toggle('selected', c.querySelector('input').checked));
    });
  });
}

function buildTemplatesForSetup(defaultDesignId) {
  const pick = HANDOVER_DESIGN_CATALOG.find((p) => p.id === defaultDesignId) || HANDOVER_DESIGN_CATALOG[0];
  const base = defaultTemplateFields();
  // One template per visual design; selected design becomes the default (first).
  const all = HANDOVER_DESIGN_CATALOG.map((d) => ({
    ...base,
    id: d.id,
    name: d.name,
    design: d.id,
  }));
  const chosen = all.find((t) => t.id === pick.id) || all[0];
  return [chosen, ...all.filter((t) => t.id !== chosen.id)];
}

// Guided feature tour shown before the setup form — one slide per product area.
const OB_TOUR = [
  {
    id: 'welcome', icon: 'inventory_2',
    title: 'Welcome to IT Asset Control',
    desc: 'Your self-hosted ITAM workspace for hardware, people, zimmet paperwork, licenses, lines, repairs and stock counts — with a full audit trail.',
    bullets: [
      'Everything in one app — no more scattered Excel sheets',
      'Printable zimmet forms with multiple visual designs',
      'Roles, search and alerts built in from day one',
    ],
    tip: 'After setup, use Help (?) anytime to replay this tour or toggle UI tips.',
    preview: 'welcome',
  },
  {
    id: 'dashboard', icon: 'dashboard', route: '#/dashboard',
    title: 'Dashboard',
    desc: 'Start here every morning — KPIs, recent handovers, EOL warnings and license / stock alerts.',
    bullets: [
      'Asset counts by status (In Stock, Assigned, Repair…)',
      'Expiring licenses & low consumables callouts',
      'Jump straight into overdue lifecycle devices',
    ],
    tip: 'Open Notifications (bell) for the same alerts from any page.',
    preview: 'dashboard',
  },
  {
    id: 'hardware', icon: 'devices', route: '#/assets',
    title: 'Hardware Inventory',
    desc: 'The live register of every device — laptops, monitors, phones, network gear and more.',
    bullets: [
      'Auto sequential asset tags + QR / barcode labels',
      'Filters: status, location, category, lifecycle (EOL)',
      'Bulk return, repair, labels — and Excel/CSV import',
    ],
    tip: 'Use the green “New Asset” button in the sidebar for the fastest add.',
    preview: 'hardware',
  },
  {
    id: 'catalog', icon: 'category', route: '#/catalog',
    title: 'Product Catalog',
    desc: 'Central lists that feed every form — brands aren’t free-typed chaos.',
    bullets: [
      'Categories with default lifecycle months',
      'CPU / RAM / Storage option lists',
      'Locations & departments used across the app',
    ],
    tip: 'Update catalog first if you want clean dropdowns on new assets.',
    preview: 'catalog',
  },
  {
    id: 'employees', icon: 'badge', route: '#/employees',
    title: 'Employees',
    desc: 'Who holds what — devices, software seats, mobile lines and signed documents.',
    bullets: [
      'Employee card with active assets & history timeline',
      'Reprint zimmet or generate a current assignment form',
      'Upload signed PDF / photo scans to the archive',
    ],
    tip: 'Open an employee → Documents tab for generated PDFs and signed scans.',
    preview: 'employees',
  },
  {
    id: 'handover', icon: 'assignment_turned_in', route: '#/handover',
    title: 'Handover (Zimmet)',
    desc: 'Atomic basket: pick an employee, add hardware and/or mobile lines, confirm — print or download PDF.',
    bullets: [
      'Single or separate documents per item',
      'Multiple visual zimmet designs (Terminal, Classic…)',
      'Optional return section & editable print preview',
    ],
    tip: 'Choose the form design in Settings — or switch it in the print dialog.',
    preview: 'handover',
  },
  {
    id: 'licenses', icon: 'workspace_premium', route: '#/licenses',
    title: 'Software & Licenses',
    desc: 'Seat pools with assign / revoke — software zimmet next to hardware.',
    bullets: [
      'Total vs used seats, atomic claim',
      'Assign from the employee detail or license screen',
      '30-day expiry alerts on the dashboard',
    ],
    tip: 'Revoking a seat frees it immediately for someone else.',
    preview: 'licenses',
  },
  {
    id: 'lines', icon: 'sim_card', route: '#/lines',
    title: 'Mobile Lines',
    desc: 'Company SIMs and phone numbers — assignable like devices and listed on zimmet forms.',
    bullets: [
      'Operator, plan, SIM serial, monthly cost',
      'Assign / take-back with history',
      'Add free lines into the handover basket',
    ],
    tip: 'Only Active + unassigned lines appear in the zimmet basket.',
    preview: 'lines',
  },
  {
    id: 'consumables', icon: 'inventory_2', route: '#/consumables',
    title: 'Consumables',
    desc: 'Toner, cables, adapters — stock levels with minimum alerts.',
    bullets: [
      'Track quantity and reorder threshold',
      'Low-stock chips on the dashboard',
      'Simple adjustments without full asset tagging',
    ],
    tip: 'Set minimum stock so the bell icon warns you before you run out.',
    preview: 'consumables',
  },
  {
    id: 'maintenance', icon: 'build', route: '#/maintenance',
    title: 'Maintenance & Repair',
    desc: 'Send a device to service, add progress notes, return or scrap — with paperwork attached.',
    bullets: [
      'Repair state restores previous assignment when possible',
      'Notes land in the device history',
      'Attach invoices / photos to the repair log',
    ],
    tip: 'Start a repair from the asset row — not only from this screen.',
    preview: 'maintenance',
  },
  {
    id: 'stockcount', icon: 'fact_check', route: '#/stockcount',
    title: 'Stock Count',
    desc: 'Physical inventory sessions — scan barcodes (camera or photo) and close against live stock.',
    bullets: [
      'Open a count, scan from any signed-in device',
      'Found / missing / unknown filters when closed',
      'Export filtered CSV of the result',
    ],
    tip: 'On phones, prefer continuous camera scan over rebuilding the page.',
    preview: 'stockcount',
  },
  {
    id: 'reports', icon: 'summarize', route: '#/reports',
    title: 'Reports',
    desc: 'Preset and custom reports — columns, filters, CSV export and letterhead print.',
    bullets: [
      'Ready-made presets for common IT questions',
      'Build your own from multiple data sources',
      'Export CSV for Excel or print with company branding',
    ],
    tip: 'Use presets first — then clone the idea into a custom report.',
    preview: 'reports',
  },
  {
    id: 'users', icon: 'vpn_key', route: '#/users',
    title: 'IT Users & Security',
    desc: 'Invite your team with the right role. Owner controls branding and templates.',
    bullets: [
      'Owner / Admin / Helpdesk / Viewer',
      'Disable accounts without losing audit history',
      'Hardened defaults: CSP, rate limits, transactional writes',
    ],
    tip: 'Only Owner can open Settings → zimmet designs and company logo.',
    preview: 'users',
  },
];

function obPreviewHtml(kind) {
  const shell = (main) => `
    <div class="ob-mock" aria-hidden="true">
      <div class="ob-mock-side">
        <div class="ob-mock-logo"></div>
        <i></i><i></i><i class="on"></i><i></i><i></i>
      </div>
      <div class="ob-mock-main">${main}</div>
    </div>`;
  const map = {
    welcome: `
      <div class="ob-mock-hero">
        <strong>IT Asset Control Pro</strong>
        <span>Hardware · People · Zimmet · Licenses · Lines</span>
      </div>
      <div class="ob-mock-chips"><b></b><b></b><b></b><b></b></div>`,
    dashboard: `
      <div class="ob-mock-kpis"><b></b><b></b><b></b><b></b></div>
      <div class="ob-mock-row"></div><div class="ob-mock-row short"></div>
      <div class="ob-mock-alert"></div>`,
    hardware: `
      <div class="ob-mock-toolbar"><b></b><b></b><span></span></div>
      <div class="ob-mock-table"><i></i><i></i><i></i><i></i></div>`,
    catalog: `
      <div class="ob-mock-grid"><b></b><b></b><b></b><b></b></div>
      <div class="ob-mock-row"></div>`,
    employees: `
      <div class="ob-mock-person"><span></span><div><b></b><i></i></div></div>
      <div class="ob-mock-tabs"><b class="on"></b><b></b><b></b></div>
      <div class="ob-mock-row"></div><div class="ob-mock-row short"></div>`,
    handover: `
      <div class="ob-mock-split">
        <div><div class="ob-mock-row"></div><div class="ob-mock-row"></div></div>
        <div class="ob-mock-basket"><b>Basket</b><i></i><i></i></div>
      </div>`,
    licenses: `
      <div class="ob-mock-toolbar"><b></b><span></span></div>
      <div class="ob-mock-seats"><b></b><b></b><b></b></div>`,
    lines: `
      <div class="ob-mock-table sim"><i></i><i></i><i></i></div>`,
    consumables: `
      <div class="ob-mock-kpis small"><b></b><b></b></div>
      <div class="ob-mock-row"></div><div class="ob-mock-row warn"></div>`,
    maintenance: `
      <div class="ob-mock-row"></div>
      <div class="ob-mock-note"></div>
      <div class="ob-mock-row short"></div>`,
    stockcount: `
      <div class="ob-mock-scan"><span></span></div>
      <div class="ob-mock-chips"><b></b><b></b><b></b></div>`,
    reports: `
      <div class="ob-mock-grid"><b></b><b></b><b></b></div>
      <div class="ob-mock-row"></div>`,
    users: `
      <div class="ob-mock-person"><span></span><div><b></b><i></i></div></div>
      <div class="ob-mock-person"><span></span><div><b></b><i></i></div></div>`,
  };
  return shell(map[kind] || map.welcome);
}

let obStep = 0;

function renderTour() {
  const total = OB_TOUR.length + 1; // +1 for the setup step
  $('#ob-bar').style.width = `${(obStep / (total - 1)) * 100}%`;
  $('#ob-skip').style.display = obStep === OB_TOUR.length ? 'none' : '';
  const stepLabel = $('#ob-step-label');
  if (stepLabel) {
    stepLabel.textContent = obStep >= OB_TOUR.length
      ? `Setup · ${total}/${total}`
      : `${obStep + 1} / ${total}`;
  }

  const setup = $('#ob-setup');
  const tour = $('#ob-tour');
  if (obStep >= OB_TOUR.length) {
    tour.classList.add('hidden');
    setup.classList.remove('hidden');
    renderObTplCards();
    return;
  }
  setup.classList.add('hidden');
  tour.classList.remove('hidden');

  const s = OB_TOUR[obStep];
  const last = obStep === OB_TOUR.length - 1;
  tour.innerHTML = `
    <div class="ob-layout">
      <aside class="ob-rail" aria-label="Features">
        ${OB_TOUR.map((item, i) => `
          <button type="button" class="ob-rail-item ${i === obStep ? 'on' : ''} ${i < obStep ? 'done' : ''}" data-dot="${i}">
            <span class="ms">${item.icon}</span>
            <span class="ob-rail-label">${esc(item.title.split('(')[0].trim())}</span>
          </button>`).join('')}
        <button type="button" class="ob-rail-item setup" data-dot="${OB_TOUR.length}">
          <span class="ms">rocket_launch</span>
          <span class="ob-rail-label">Setup</span>
        </button>
      </aside>
      <div class="ob-slide ob-slide-rich">
        <span class="ob-slide-badge"><span class="ms ms-sm">${s.icon}</span> ${esc(s.title)}</span>
        <div class="ob-slide-grid">
          <div>
            <h2 class="ob-slide-title">${esc(s.title)}</h2>
            <p class="ob-slide-desc">${esc(s.desc)}</p>
            <ul class="ob-bullets">
              ${s.bullets.map((b) => `<li><span class="ms">check_circle</span> ${esc(b)}</li>`).join('')}
            </ul>
            ${s.tip ? `<div class="ob-tip-callout"><span class="ms">lightbulb</span> ${esc(s.tip)}</div>` : ''}
          </div>
          <div class="ob-preview-wrap">
            ${obPreviewHtml(s.preview)}
            <div class="ob-preview-caption">Interface preview</div>
          </div>
        </div>
        <div class="ob-nav">
          <button type="button" class="btn btn-outline" id="ob-back" ${obStep === 0 ? 'disabled' : ''}>
            <span class="ms">arrow_back</span> Back</button>
          <button type="button" class="btn btn-primary" id="ob-next">
            ${last ? 'Continue to setup' : 'Next'} <span class="ms">arrow_forward</span></button>
        </div>
      </div>
    </div>`;

  $('#ob-back', tour).addEventListener('click', () => { if (obStep > 0) { obStep--; renderTour(); } });
  $('#ob-next', tour).addEventListener('click', () => { obStep++; renderTour(); });
  tour.querySelectorAll('[data-dot]').forEach((d) =>
    d.addEventListener('click', () => { obStep = Number(d.dataset.dot); renderTour(); }));
}

function bindOnboarding() {
  const form = $('#onboarding-form');

  // Language picker: applies immediately to this browser and is saved as the
  // instance default when setup completes (changeable later in Settings).
  const langSel = $('#ob-lang');
  langSel.innerHTML = Object.entries(I18N_LANGS)
    .map(([code, name]) => `<option value="${code}" ${i18nLang() === code ? 'selected' : ''}>${name}</option>`).join('');
  langSel.addEventListener('change', () => setLang(langSel.value));

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
        language: i18nLang(), // chosen during the tour → instance default
        defaultTemplateId: obDefaultTplId,
        handoverTemplates: buildTemplatesForSetup(obDefaultTplId),
      };
      // Tips preference (UI coach marks after first login)
      const tipsBox = form.elements.enableTips;
      localStorage.setItem('itacm_tips', tipsBox && tipsBox.checked ? '1' : '0');
      if (tipsBox && tipsBox.checked) localStorage.setItem('itacm_tips_pending', '1');

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
  const tipsOn = tipsEnabled();
  const routeTip = tipForCurrentRoute();
  openModal({
    title: 'Help & tips',
    wide: true,
    body: `
      <div class="gs-section">UI tips</div>
      <label class="ob-check" style="margin-bottom:12px">
        <input type="checkbox" id="help-tips-toggle" ${tipsOn ? 'checked' : ''}>
        <span>Show page tips under the top bar (lightbulb banners)</span>
      </label>
      ${routeTip ? `<div class="ob-tip-callout" style="margin-bottom:14px">
        <span class="ms">lightbulb</span>
        <div><strong>This page:</strong> ${esc(routeTip.tip || routeTip.desc)}</div>
      </div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <button type="button" class="btn btn-outline" id="help-page-tip"><span class="ms">push_pin</span> Show tip for this page</button>
        <button type="button" class="btn btn-outline" id="help-ui-tour"><span class="ms">tour</span> Guided sidebar tour</button>
        <button type="button" class="btn btn-outline" id="help-product-tour"><span class="ms">auto_awesome</span> Replay product intro</button>
      </div>
      <div class="gs-section">Keyboard</div>
      <div class="gs-item"><span class="ms">keyboard_command_key</span><div style="flex:1">Focus global search</div><code>Cmd/Ctrl + K</code></div>
      <div class="gs-section">Roles</div>
      <div class="gs-item">${badge('Owner')}<div style="flex:1">Branding, zimmet designs, IT users</div></div>
      <div class="gs-item">${badge('Admin')}<div style="flex:1">Day-to-day ops + user management</div></div>
      <div class="gs-item">${badge('Helpdesk')}<div style="flex:1">Assets, handovers, repairs, software zimmet</div></div>
      <div class="gs-item">${badge('Viewer')}<div style="flex:1">Read-only inventory and dashboards</div></div>
      <div class="gs-section">About</div>
      <div class="cell-sub">ITACM — IT Asset Control Pro. Backend: ${esc(AppConfig.backend)}.
        Handovers and seat moves are transactional with a full audit trail.</div>`,
    foot: '<button class="btn btn-outline" data-close>Close</button>',
    onMount(overlay) {
      $('#help-tips-toggle', overlay).addEventListener('change', (e) => {
        setTipsEnabled(e.target.checked);
        renderPageTip();
        toast(e.target.checked ? 'Page tips enabled' : 'Page tips hidden', 'success');
      });
      $('#help-page-tip', overlay).addEventListener('click', () => {
        closeModal();
        setTipsEnabled(true);
        renderPageTip({ force: true });
        toast('Tip pinned under the top bar', 'success');
      });
      $('#help-ui-tour', overlay).addEventListener('click', () => {
        closeModal();
        startUiTour();
      });
      $('#help-product-tour', overlay).addEventListener('click', () => {
        closeModal();
        showProductTourModal();
      });
    },
  });
}

/* ---- In-app tips & coach marks ---- */
function tipsEnabled() {
  return localStorage.getItem('itacm_tips') !== '0';
}
function setTipsEnabled(on) {
  localStorage.setItem('itacm_tips', on ? '1' : '0');
}

function tipForCurrentRoute() {
  const [raw] = (location.hash || '#/dashboard').split('?');
  return OB_TOUR.find((s) => s.route === raw) || null;
}

function renderPageTip(opts = {}) {
  const el = $('#page-tip');
  if (!el) return;
  const tip = tipForCurrentRoute();
  if (!tip || (!tipsEnabled() && !opts.force)) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <span class="ms">lightbulb</span>
    <div class="page-tip-body">
      <strong>${esc(tip.title)}</strong>
      <span>${esc(tip.tip || tip.desc)}</span>
    </div>
    <button type="button" class="page-tip-dismiss" id="page-tip-hide" title="Hide tips">
      <span class="ms">close</span>
    </button>`;
  const hide = $('#page-tip-hide', el);
  if (hide) hide.addEventListener('click', () => {
    setTipsEnabled(false);
    el.classList.add('hidden');
    toast('Tips turned off — re-enable from Help (?)', 'success');
  });
}

function showProductTourModal() {
  let step = 0;
  const paint = (overlay) => {
    const s = OB_TOUR[step];
    $('#pt-body', overlay).innerHTML = `
      <div class="ob-slide-grid" style="margin:0">
        <div>
          <span class="ob-slide-badge"><span class="ms ms-sm">${s.icon}</span> ${step + 1}/${OB_TOUR.length}</span>
          <h2 class="ob-slide-title" style="font-size:20px">${esc(s.title)}</h2>
          <p class="ob-slide-desc">${esc(s.desc)}</p>
          <ul class="ob-bullets">${s.bullets.map((b) => `<li><span class="ms">check_circle</span> ${esc(b)}</li>`).join('')}</ul>
          ${s.tip ? `<div class="ob-tip-callout"><span class="ms">lightbulb</span> ${esc(s.tip)}</div>` : ''}
        </div>
        <div class="ob-preview-wrap">${obPreviewHtml(s.preview)}</div>
      </div>`;
    $('#pt-back', overlay).disabled = step === 0;
    $('#pt-next', overlay).innerHTML = step === OB_TOUR.length - 1
      ? '<span class="ms">check</span> Done'
      : 'Next <span class="ms">arrow_forward</span>';
  };
  openModal({
    title: 'Product tour',
    wide: true,
    body: '<div id="pt-body"></div>',
    foot: `<button class="btn btn-outline" id="pt-back"><span class="ms">arrow_back</span> Back</button>
           <button class="btn btn-outline" data-close>Close</button>
           <button class="btn btn-primary" id="pt-next">Next</button>`,
    onMount(overlay) {
      paint(overlay);
      $('#pt-back', overlay).addEventListener('click', () => { if (step > 0) { step--; paint(overlay); } });
      $('#pt-next', overlay).addEventListener('click', () => {
        if (step >= OB_TOUR.length - 1) closeModal();
        else { step++; paint(overlay); }
      });
    },
  });
}

function startUiTour() {
  const steps = OB_TOUR.filter((s) => s.route);
  let i = 0;
  const coach = $('#tip-coach');
  if (!coach) return;

  const clear = () => {
    coach.classList.add('hidden');
    coach.innerHTML = '';
    $$('#nav a.tip-highlight').forEach((a) => a.classList.remove('tip-highlight'));
  };

  const show = () => {
    if (i >= steps.length) {
      clear();
      toast('Sidebar tour complete', 'success');
      return;
    }
    const s = steps[i];
    location.hash = s.route;
    setTimeout(() => {
      $$('#nav a').forEach((a) => a.classList.toggle('tip-highlight', a.dataset.route === s.route));
      const navLink = $(`#nav a[data-route="${s.route}"]`);
      let top = 120;
      let left = 280;
      if (navLink) {
        const r = navLink.getBoundingClientRect();
        top = Math.min(window.innerHeight - 180, Math.max(72, r.top));
        left = Math.min(window.innerWidth - 340, r.right + 12);
      }
      coach.classList.remove('hidden');
      coach.style.top = `${top}px`;
      coach.style.left = `${left}px`;
      coach.innerHTML = `
        <div class="tip-coach-card">
          <div class="tip-coach-head">
            <span class="ms">${s.icon}</span>
            <strong>${esc(s.title)}</strong>
            <span class="cell-sub">${i + 1}/${steps.length}</span>
          </div>
          <p>${esc(s.tip || s.desc)}</p>
          <div class="tip-coach-actions">
            <button type="button" class="btn btn-outline btn-sm" id="coach-skip">Skip tour</button>
            <button type="button" class="btn btn-primary btn-sm" id="coach-next">
              ${i === steps.length - 1 ? 'Finish' : 'Next'} <span class="ms">arrow_forward</span>
            </button>
          </div>
        </div>`;
      $('#coach-skip', coach).addEventListener('click', clear);
      $('#coach-next', coach).addEventListener('click', () => { i++; show(); });
      renderPageTip();
    }, 280);
  };
  setTipsEnabled(true);
  show();
}

function showSettings() {
  if (!Auth.can('canManageBranding')) {
    toast('Only the Owner can change company & branding settings', 'error');
    return;
  }
  let newLogo = null;

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
          <label>Company address <span class="ob-hint">(shown under the logo on the zimmet form — optional)</span></label>
          <input id="set-address" value="${esc(AppConfig.companyAddress || '')}" maxlength="200"
            placeholder="e.g. Maslak, İstanbul / Büyükdere Cad. No:123">
        </div>
        <div class="form-field full">
          <label>Handover form terms — printed on every Zimmet Tutanağı.
            <span class="ob-hint">Separate paragraphs with a blank line; the 2nd paragraph renders italic (TR translation).</span></label>
          <textarea id="set-terms" rows="6">${esc(AppConfig.handoverTerms || '')}</textarea>
        </div>
        <div class="form-field">
          <label>Language / Dil <span class="ob-hint">(applies to this browser now; saved as the instance default)</span></label>
          <select id="set-lang">
            ${Object.entries(I18N_LANGS).map(([code, name]) =>
              `<option value="${code}" ${i18nLang() === code ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field full">
          <label>Default zimmet design <span class="ob-hint">(visual look of the printed form)</span></label>
          <div class="ob-tpl-cards" id="set-design-cards" style="margin-top:8px"></div>
          <div style="margin-top:10px">
            <button type="button" class="btn btn-outline" id="set-customize-tpl">
              <span class="ms">tune</span> Fine-tune fields &amp; labels…</button>
          </div>
        </div>
      </div>

      <div class="gs-section" style="margin:18px 0 6px">Handover &amp; Repair Documents</div>
      <p class="cell-sub" style="margin:0 0 4px">Uploaded signed handover scans and repair paperwork are stored
        <strong>securely in your database</strong> — access-controlled by role and included in your
        <code>npm run backup</code> snapshots.</p>
      <p class="cell-sub" style="margin:0"><span class="ms ms-sm" style="vertical-align:-2px">verified_user</span>
        Only PDF and image files (PDF / PNG / JPEG / WebP, max 8MB) are accepted; the file type is verified on the server.
        <em>External cloud storage (SharePoint / Google Drive) is not enabled — it would require a connector configured with
        your organisation's credentials.</em></p>`,
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
      $('#set-customize-tpl', overlay).addEventListener('click', () => showTemplateCustomizer());
      // Design picker cards — selecting one promotes that template (by design id) to default.
      const designBox = $('#set-design-cards', overlay);
      let selectedDesign = (AppConfig.handoverTemplate && AppConfig.handoverTemplate.design)
        || (AppConfig.handoverTemplates && AppConfig.handoverTemplates[0] && AppConfig.handoverTemplates[0].design)
        || 'terminal';
      const renderDesignCards = () => {
        designBox.innerHTML = HANDOVER_DESIGN_CATALOG.map((p) => `
          <label class="ob-tpl-card ${selectedDesign === p.id ? 'selected' : ''}">
            <input type="radio" name="setDesign" value="${esc(p.id)}" ${selectedDesign === p.id ? 'checked' : ''}>
            <span class="ob-tpl-card-body">
              <strong>${esc(p.name)} ${designSwatchesHtml(p.swatches)}</strong>
              <span>${esc(p.desc)}</span>
            </span>
          </label>`).join('');
        designBox.querySelectorAll('input[name="setDesign"]').forEach((inp) => {
          inp.addEventListener('change', () => {
            selectedDesign = inp.value;
            renderDesignCards();
          });
        });
      };
      renderDesignCards();

      $('#set-save', overlay).addEventListener('click', async () => {
        try {
          const langChoice = $('#set-lang', overlay).value;
          // Ensure a template exists for the chosen design, then promote it.
          let list = (AppConfig.handoverTemplates && AppConfig.handoverTemplates.length
            ? AppConfig.handoverTemplates.map((t) => ({ ...defaultTemplateFields(), ...t }))
            : buildTemplatesForSetup(selectedDesign));
          if (!list.some((t) => t.design === selectedDesign || t.id === selectedDesign)) {
            const d = HANDOVER_DESIGN_CATALOG.find((x) => x.id === selectedDesign);
            list = [{
              ...defaultTemplateFields(),
              id: selectedDesign,
              name: (d && d.name) || selectedDesign,
              design: selectedDesign,
            }, ...list];
          }
          // Match by design field first, then id.
          const idx = list.findIndex((t) => t.design === selectedDesign || t.id === selectedDesign);
          if (idx > 0) {
            const [row] = list.splice(idx, 1);
            row.design = selectedDesign;
            list.unshift(row);
          } else if (idx === 0) {
            list[0].design = selectedDesign;
          }
          const saved = await api('/settings', {
            method: 'PUT',
            body: {
              companyName: $('#set-company', overlay).value.trim(),
              companyLogo: newLogo || undefined,
              companyAddress: $('#set-address', overlay).value.trim(),
              handoverTerms: $('#set-terms', overlay).value,
              language: langChoice,
              handoverTemplates: list,
              defaultTemplateId: list[0].id,
            },
          });
          AppConfig.companyName = saved.companyName;
          AppConfig.companyLogo = saved.companyLogo;
          AppConfig.companyAddress = saved.companyAddress;
          AppConfig.handoverTerms = saved.handoverTerms;
          AppConfig.handoverTemplates = saved.handoverTemplates;
          AppConfig.handoverTemplate = saved.handoverTemplate;
          applyBranding();
          toast('Settings saved', 'success');
          closeModal();
          if (langChoice !== i18nLang()) setLang(langChoice); // reloads with the new language
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

/* ---- Zimmet Tutanağı multi-template manager (popup with live preview) ---- */
function newClientTemplateId() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTemplateFields() {
  return {
    design: 'terminal',
    titleEn: 'Asset Handover', titleTr: 'Zimmet Belgesi',
    subtitle: 'Corporate Resource Management',
    showLogo: true, showEmployeeId: true, showDepartment: true, showTitle: true,
    colCategory: true, colSerial: true, colMac: false, colCondition: true,
    showTerms: true, showReturnSection: false,
    deliveredByLabel: '', receivedByLabel: '', footerNote: '',
  };
}

function showTemplateCustomizer() {
  if (!Auth.can('canManageBranding')) {
    toast('Only the Owner can customize the handover template', 'error');
    return;
  }

  // Working copy of the full template list. First entry = default for new handovers.
  let list = (AppConfig.handoverTemplates && AppConfig.handoverTemplates.length
    ? AppConfig.handoverTemplates
    : [{ id: 'default', name: 'Standard', ...(AppConfig.handoverTemplate || defaultTemplateFields()) }]
  ).map((t) => ({ ...defaultTemplateFields(), ...t }));
  let activeId = list[0].id;

  const TOGGLES = [
    ['Header', [['showLogo', 'Company logo']]],
    ['Employee fields', [['showEmployeeId', 'Employee ID / Sicil No'], ['showDepartment', 'Department'], ['showTitle', 'Position / Title']]],
    ['Equipment columns', [['colCategory', 'Category'], ['colSerial', 'Serial number'], ['colMac', 'MAC address'], ['colCondition', 'Condition']]],
    ['Sections', [['showTerms', 'Terms & Conditions'], ['showReturnSection', 'Equipment return section']]],
  ];
  const TEXTS = [
    ['titleEn', 'Title (English)', 60], ['titleTr', 'Title (Turkish)', 60], ['subtitle', 'Header subtitle', 100],
    ['deliveredByLabel', 'Delivered-by label', 80], ['receivedByLabel', 'Received-by label', 80], ['footerNote', 'Footer note (optional)', 200],
  ];

  const sampleTerms = `<p>${esc(t('handover.termsBody'))}</p>`;
  const sample = {
    companyName: AppConfig.companyName, companyLogo: AppConfig.companyLogo,
    companyAddress: AppConfig.companyAddress,
    formNo: 'HF-ÖRNEK01', formSuffix: '', dateStr: new Date().toLocaleDateString(),
    pageNum: 1, pageTotal: 1,
    employeeName: 'Ahmet Yılmaz', employeeId: 'EMP12345', department: 'Bilgi İşlem', title: 'Sistem Uzmanı',
    deliveredByName: (Auth.profile && Auth.profile.username) || 'IT Department', termsHtml: sampleTerms,
    items: [
      { brand: 'Dell', model: 'Latitude 5540', category: 'Laptop', serialNumber: 'SN-10231', macAddress: 'AA:BB:CC:11:22', conditionNote: 'New' },
      { brand: 'LG', model: '27UP850', category: 'Monitor', serialNumber: 'MN-88120', macAddress: 'N/A', conditionNote: 'Good' },
      { kind: 'line', phoneNumber: '+90 532 000 00 00', operator: 'Turkcell', plan: 'Kurumsal 20GB', simSerial: '8990012345678901234' },
    ],
  };

  const active = () => list.find((t) => t.id === activeId) || list[0];

  openModal({
    title: 'Manage Zimmet Templates',
    wide: true,
    body: `
      <div class="tc-grid">
        <div class="tc-options">
          <div class="gs-section" style="margin:0 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span>Templates</span>
            <span style="display:flex;gap:4px">
              <button type="button" class="btn btn-outline btn-sm" id="tc-add" title="Add"><span class="ms">add</span></button>
              <button type="button" class="btn btn-outline btn-sm" id="tc-dup" title="Duplicate"><span class="ms">content_copy</span></button>
            </span>
          </div>
          <div id="tc-list" class="tc-tpl-list"></div>
          <div class="cell-sub" style="margin:8px 0 12px">First in the list is the default. Use ↑ to promote.</div>
          <div id="tc-editor"></div>
        </div>
        <div class="tc-preview-wrap">
          <div class="gs-section" style="margin:6px 0 8px">Live preview</div>
          <div class="tc-preview-scroll"><div id="tc-preview"></div></div>
        </div>
      </div>`,
    foot: `<button class="btn btn-outline" data-close>Cancel</button>
           <button class="btn btn-primary" id="tc-save"><span class="ms">save</span> Save all templates</button>`,
    onMount(overlay) {
      const editor = $('#tc-editor', overlay);
      const listEl = $('#tc-list', overlay);

      const renderList = () => {
        listEl.innerHTML = list.map((t, i) => `
          <div class="tc-tpl-item ${t.id === activeId ? 'selected' : ''}" data-id="${esc(t.id)}">
            <button type="button" class="tc-tpl-pick grow" data-pick="${esc(t.id)}">
              <strong>${esc(t.name || 'Untitled')}</strong>
              ${i === 0 ? '<span class="stock-chip" style="margin-left:6px">Default</span>' : ''}
            </button>
            <button type="button" class="icon-btn" data-up="${esc(t.id)}" title="Make default / move up" ${i === 0 ? 'disabled' : ''}>
              <span class="ms">arrow_upward</span>
            </button>
            <button type="button" class="icon-btn" data-del="${esc(t.id)}" title="Delete" ${list.length <= 1 ? 'disabled' : ''}>
              <span class="ms">delete</span>
            </button>
          </div>`).join('');
        listEl.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
          activeId = b.dataset.pick;
          renderAll();
        }));
        listEl.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
          const idx = list.findIndex((t) => t.id === b.dataset.up);
          if (idx <= 0) return;
          const [row] = list.splice(idx, 1);
          list.unshift(row);
          activeId = row.id;
          renderAll();
        }));
        listEl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
          if (list.length <= 1) return;
          if (!confirm('Delete this template?')) return;
          list = list.filter((t) => t.id !== b.dataset.del);
          if (!list.find((t) => t.id === activeId)) activeId = list[0].id;
          renderAll();
        }));
      };

      const renderEditor = () => {
        const tpl = active();
        const designOpts = HANDOVER_DESIGN_CATALOG.map((d) =>
          `<option value="${esc(d.id)}" ${tpl.design === d.id ? 'selected' : ''}>${esc(d.name)}</option>`
        ).join('');
        editor.innerHTML = `
          <div class="form-field" style="margin-bottom:10px">
            <label>Template name</label>
            <input data-tpl="name" maxlength="60" value="${esc(tpl.name || '')}" placeholder="e.g. Terminal / Classic">
          </div>
          <div class="form-field" style="margin-bottom:10px">
            <label>Visual design</label>
            <select data-tpl="design">${designOpts}</select>
            <div style="margin-top:6px">${designSwatchesHtml(
              (HANDOVER_DESIGN_CATALOG.find((d) => d.id === tpl.design) || HANDOVER_DESIGN_CATALOG[0]).swatches
            )}</div>
          </div>
          ${TOGGLES.map(([grp, items]) => `
            <div class="gs-section" style="margin:6px 0 6px">${esc(grp)}</div>
            ${items.map(([k, l]) =>
              `<label class="tc-opt"><input type="checkbox" data-tpl="${k}" ${tpl[k] ? 'checked' : ''}> ${esc(l)}</label>`
            ).join('')}`).join('')}
          <div class="gs-section" style="margin:14px 0 6px">Titles & labels</div>
          ${TEXTS.map(([k, l, m]) =>
            `<div class="form-field" style="margin-bottom:8px"><label>${esc(l)}</label>
               <input data-tpl="${k}" maxlength="${m}" value="${esc(tpl[k] == null ? '' : tpl[k])}"></div>`
          ).join('')}`;
        editor.querySelectorAll('[data-tpl]').forEach((inp) => {
          const evt = inp.type === 'checkbox' ? 'change' : 'input';
          const ev2 = inp.tagName === 'SELECT' ? 'change' : evt;
          inp.addEventListener(ev2, () => {
            const cur = active();
            cur[inp.dataset.tpl] = inp.type === 'checkbox' ? inp.checked : inp.value;
            if (inp.dataset.tpl === 'name') renderList();
            if (inp.dataset.tpl === 'design') {
              const d = HANDOVER_DESIGN_CATALOG.find((x) => x.id === cur.design);
              if (d && (!cur.name || HANDOVER_DESIGN_CATALOG.some((x) => x.name === cur.name))) {
                cur.name = d.name;
                renderList();
              }
              renderEditor();
              renderPreview();
              return;
            }
            renderPreview();
          });
        });
      };

      const renderPreview = () => {
        $('#tc-preview', overlay).innerHTML =
          `<div class="preview-paper">${handoverReceiptHTML(sample, active())}</div>`;
      };

      const renderAll = () => {
        renderList();
        renderEditor();
        renderPreview();
      };

      $('#tc-add', overlay).addEventListener('click', () => {
        if (list.length >= 12) { toast('Maximum 12 templates', 'error'); return; }
        const n = {
          id: newClientTemplateId(),
          name: `Template ${list.length + 1}`,
          ...defaultTemplateFields(),
        };
        list.push(n);
        activeId = n.id;
        renderAll();
      });
      $('#tc-dup', overlay).addEventListener('click', () => {
        if (list.length >= 12) { toast('Maximum 12 templates', 'error'); return; }
        const src = active();
        const n = { ...src, id: newClientTemplateId(), name: `${src.name || 'Template'} (copy)` };
        list.push(n);
        activeId = n.id;
        renderAll();
      });

      $('#tc-save', overlay).addEventListener('click', async () => {
        try {
          if (list.some((t) => !String(t.name || '').trim())) {
            throw new Error('Every template needs a name');
          }
          const saved = await api('/settings', { method: 'PUT', body: { handoverTemplates: list } });
          AppConfig.handoverTemplates = saved.handoverTemplates;
          AppConfig.handoverTemplate = saved.handoverTemplate;
          toast('Zimmet templates saved', 'success');
          closeModal();
        } catch (err) { toast(err.message, 'error'); }
      });

      renderAll();
    },
  });
}

/** Resolve a handover template by id (falls back to default / first). */
function resolveHandoverTpl(templateId) {
  const list = AppConfig.handoverTemplates || [];
  if (templateId && list.length) {
    const found = list.find((t) => t.id === templateId);
    if (found) return found;
  }
  return AppConfig.handoverTemplate || list[0] || defaultTemplateFields();
}

function handoverTplSelectHtml(selectedId) {
  const list = AppConfig.handoverTemplates && AppConfig.handoverTemplates.length
    ? AppConfig.handoverTemplates
    : HANDOVER_DESIGN_CATALOG.map((d) => ({ id: d.id, name: d.name, design: d.id }));
  const sel = selectedId || (list[0] && list[0].id) || '';
  return `<label class="ho-tpl-pick" style="display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap">
    <span class="cell-sub" style="font-weight:600">${esc(t('handover.template'))}</span>
    <select id="ho-tpl-select" style="min-width:180px;flex:1">
      ${list.map((tpl) => {
        const d = HANDOVER_DESIGN_CATALOG.find((x) => x.id === (tpl.design || tpl.id));
        const label = tpl.name || (d && d.name) || tpl.id;
        return `<option value="${esc(tpl.id)}" ${tpl.id === sel ? 'selected' : ''}>${esc(label)}</option>`;
      }).join('')}
    </select>
  </label>`;
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
  applyStaticI18n(); // translate login/topbar statics per the resolved language
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

  const menuToggle = $('#menu-toggle');
  const backdrop = $('#sidebar-backdrop');
  if (menuToggle) menuToggle.addEventListener('click', () => toggleNav());
  if (backdrop) backdrop.addEventListener('click', () => closeNav());
  // Close the drawer after picking a nav item on phones.
  $('#nav').addEventListener('click', (e) => {
    if (e.target.closest('a[data-route]')) closeNav();
  });

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
