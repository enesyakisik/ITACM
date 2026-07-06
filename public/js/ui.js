/*
 * Small UI toolkit: escaping, badges, modals, toasts, form modals.
 *
 * XSS policy: every dynamic value that enters an HTML template MUST go
 * through esc() (HTML entity encoding). innerHTML is only ever assigned
 * trusted static markup combined with esc()-encoded values — never raw
 * user/API input.
 */
'use strict';

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const STATUS_PILLS = {
  'In Stock': 'pill-emerald',
  'Assigned': 'pill-indigo',
  'In Repair': 'pill-amber',
  'Scrap': 'pill-slate',
  'Active': 'pill-emerald',
  'Inactive': 'pill-slate',
  'Owner': 'pill-rose',
  'Admin': 'pill-indigo',
  'Helpdesk': 'pill-emerald',
  'Viewer': 'pill-slate',
  'assigned': 'pill-indigo',
  'returned': 'pill-emerald',
  'sent_to_repair': 'pill-amber',
  'repair_update': 'pill-amber',
  'Completed': 'pill-emerald',
};
function badge(text) {
  return `<span class="pill ${STATUS_PILLS[text] || 'pill-slate'}">${esc(text)}</span>`;
}

/** "Elif Yılmaz" → "EY" for avatar circles. */
function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** Material Symbols icon inside a colored chip square. */
function iconChip(icon, tone) {
  return `<span class="icon-chip chip-${tone}"><span class="ms">${icon}</span></span>`;
}

/**
 * Attach a delegated click handler to a view container, aborting the previous
 * one first. Views re-render into the same #view element, so without this,
 * listeners would accumulate across renders and navigations (double modals,
 * repeated print dialogs).
 */
function bindView(el, handler) {
  if (el._viewAbort) el._viewAbort.abort();
  el._viewAbort = new AbortController();
  el.addEventListener('click', handler, { signal: el._viewAbort.signal });
}

function fmtDate(v) {
  if (!v) return '—';
  const d = typeof v === 'object' && v._seconds ? new Date(v._seconds * 1000) : new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString();
}
function fmtDateTime(v) {
  if (!v) return '—';
  const d = typeof v === 'object' && v._seconds ? new Date(v._seconds * 1000) : new Date(v);
  return isNaN(d) ? '—' : d.toLocaleString();
}

/* ---- toasts ---- */
function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  el.textContent = message; // textContent: no markup interpretation
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---- modals ---- */
function openModal({ title, body, foot, wide, onMount }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  // body/foot are templates built by callers; all dynamic values inside them
  // are esc()-encoded at the call site.
  overlay.innerHTML = `
    <div class="modal${wide ? ' modal-lg' : ''}">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="modal-close" data-close>×</button>
      </div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.hasAttribute('data-close')) closeModal();
  });
  $('#modal-root').appendChild(overlay);
  if (onMount) onMount(overlay);
  return overlay;
}
function closeModal() { $('#modal-root').innerHTML = ''; }

/*
 * Declarative form modal.
 * fields: [{ name, label, type: text|number|email|password|date|select|textarea,
 *            options: [{value,label}], required, value, placeholder, full }]
 */
function formModal({ title, fields, submitLabel = 'Save', wide, onSubmit }) {
  const inputs = fields.map((f) => {
    const val = f.value != null ? esc(f.value) : '';
    let control;
    if (f.type === 'select') {
      control = `<select name="${esc(f.name)}" ${f.required ? 'required' : ''}>
        ${(f.options || []).map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`;
        }).join('')}
      </select>`;
    } else if (f.type === 'textarea') {
      control = `<textarea name="${esc(f.name)}" placeholder="${esc(f.placeholder || '')}">${val}</textarea>`;
    } else {
      control = `<input type="${f.type || 'text'}" name="${esc(f.name)}" value="${val}"
        placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''}>`;
    }
    return `<div class="form-field ${f.full ? 'full' : ''}"><label>${esc(f.label)}</label>${control}</div>`;
  }).join('');

  openModal({
    title,
    wide,
    body: `<form id="modal-form"><div class="form-grid">${inputs}</div><div id="modal-form-error"></div></form>`,
    foot: `<button class="btn btn-outline" data-close>Cancel</button>
           <button class="btn btn-primary" type="submit" form="modal-form">${esc(submitLabel)}</button>`,
    onMount(overlay) {
      const form = $('#modal-form', overlay);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {};
        fields.forEach((f) => {
          let v = form.elements[f.name].value;
          if (f.type === 'number') v = v === '' ? undefined : Number(v);
          if (v === '') v = undefined;
          data[f.name] = v;
        });
        const btn = overlay.querySelector('.modal-foot .btn-primary');
        btn.disabled = true;
        try {
          await onSubmit(data);
          closeModal();
        } catch (err) {
          btn.disabled = false;
          const box = $('#modal-form-error', overlay);
          box.innerHTML = `<div class="form-error">${esc(err.message)}${
            err.details ? '<br>' + esc(err.details.map((d) => d.reason || JSON.stringify(d)).join('; ')) : ''
          }</div>`;
        }
      });
      const first = form.querySelector('input,select,textarea');
      if (first) first.focus();
    },
  });
}

function confirmModal(message, onYes) {
  openModal({
    title: 'Confirm',
    body: `<p style="margin:0">${esc(message)}</p>`,
    foot: `<button class="btn btn-outline" data-close>Cancel</button>
           <button class="btn btn-danger" id="confirm-yes">Confirm</button>`,
    onMount(overlay) {
      $('#confirm-yes', overlay).addEventListener('click', async () => {
        try { await onYes(); closeModal(); }
        catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}
