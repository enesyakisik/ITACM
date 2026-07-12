/** App settings (postgres): company branding, handover terms, onboarding flag. */
const { query } = require('./pool');
const { HttpError } = require('../../utils/httpError');
const {
  DEFAULT_HANDOVER_TERMS, DEFAULT_LIFECYCLES, DEFAULT_LOCATIONS, DEFAULT_SPEC_OPTIONS,
  DEFAULT_HANDOVER_TEMPLATE, DEFAULT_HANDOVER_TEMPLATES, MAX_HANDOVER_TEMPLATES,
  DEFAULT_DEPARTMENTS, HANDOVER_DESIGN_IDS,
} = require('../../utils/defaults');

const BOOL_KEYS = ['showLogo', 'showEmployeeId', 'showDepartment', 'showTitle',
  'colCategory', 'colSerial', 'colMac', 'colCondition', 'showTerms', 'showReturnSection'];
const TEXT_KEYS = {
  titleEn: 60, titleTr: 60, subtitle: 100,
  deliveredByLabel: 80, receivedByLabel: 80, footerNote: 200,
  name: 60, id: 64,
};

function newTemplateId() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Sanitize one template object (fields + optional id/name/design). */
function sanitizeTemplate(tpl, { requireName = false } = {}) {
  if (tpl == null) return null;
  if (typeof tpl !== 'object' || Array.isArray(tpl)) {
    throw HttpError.badRequest('handoverTemplate must be an object');
  }
  const out = {};
  for (const k of BOOL_KEYS) if (k in tpl) out[k] = !!tpl[k];
  for (const [k, max] of Object.entries(TEXT_KEYS)) {
    if (k in tpl) {
      const v = tpl[k] == null ? '' : String(tpl[k]).trim();
      if (v.length > max) throw HttpError.badRequest(`${k} too long (max ${max} chars)`);
      out[k] = v;
    }
  }
  if ('design' in tpl) {
    const d = String(tpl.design || '').trim();
    if (!HANDOVER_DESIGN_IDS.includes(d)) {
      throw HttpError.badRequest(`design must be one of: ${HANDOVER_DESIGN_IDS.join(', ')}`);
    }
    out.design = d;
  }
  if (requireName && !out.name) throw HttpError.badRequest('Template name is required');
  return out;
}

/**
 * Normalize stored templates into a stable array.
 * Migrates legacy single `handover_template` when the array column is empty.
 */
function normalizeTemplates(templatesRaw, legacySingle) {
  let list = [];
  if (Array.isArray(templatesRaw) && templatesRaw.length) {
    list = templatesRaw.map((t, i) => {
      const merged = { ...DEFAULT_HANDOVER_TEMPLATE, ...(t || {}) };
      return {
        ...merged,
        id: String(merged.id || `legacy_${i}`).slice(0, 64),
        name: String(merged.name || `Template ${i + 1}`).slice(0, 60),
      };
    });
  } else if (legacySingle && typeof legacySingle === 'object' && !Array.isArray(legacySingle)) {
    list = [{
      ...DEFAULT_HANDOVER_TEMPLATE,
      ...legacySingle,
      id: legacySingle.id || 'default',
      name: legacySingle.name || 'Standard',
    }];
  } else {
    list = DEFAULT_HANDOVER_TEMPLATES.map((t) => ({ ...t }));
  }
  // Deduplicate ids
  const seen = new Set();
  list = list.map((t) => {
    let id = t.id;
    if (!id || seen.has(id)) id = newTemplateId();
    seen.add(id);
    return { ...t, id };
  });
  return list.slice(0, MAX_HANDOVER_TEMPLATES);
}

function resolveTemplate(templates, templateId) {
  const list = normalizeTemplates(templates, null);
  if (templateId) {
    const found = list.find((t) => t.id === templateId);
    if (found) return found;
  }
  return list[0];
}

function sanitizeTemplatesArray(arr) {
  if (arr == null) return null;
  if (!Array.isArray(arr)) throw HttpError.badRequest('handoverTemplates must be an array');
  if (arr.length === 0) throw HttpError.badRequest('At least one handover template is required');
  if (arr.length > MAX_HANDOVER_TEMPLATES) {
    throw HttpError.badRequest(`Maximum ${MAX_HANDOVER_TEMPLATES} templates allowed`);
  }
  const seen = new Set();
  const out = arr.map((raw, i) => {
    const cleaned = sanitizeTemplate(raw, { requireName: true });
    let id = cleaned.id || newTemplateId();
    if (seen.has(id)) id = newTemplateId();
    seen.add(id);
    const merged = {
      ...DEFAULT_HANDOVER_TEMPLATE,
      ...cleaned,
      id,
      name: cleaned.name || `Template ${i + 1}`,
    };
    return merged;
  });
  return out;
}

async function getSettings() {
  const { rows } = await query(
    `SELECT company_name, company_logo, company_address, onboarded, handover_terms, lifecycles,
            locations, default_location, spec_options, document_storage, handover_template,
            handover_templates, departments, language
     FROM app_settings WHERE id = 1`
  );
  const s = rows[0] || {};
  const handoverTemplates = normalizeTemplates(s.handover_templates, s.handover_template);
  const handoverTemplate = { ...DEFAULT_HANDOVER_TEMPLATE, ...handoverTemplates[0] };
  return {
    companyName: s.company_name || 'IT Asset Control Pro',
    companyLogo: s.company_logo || null,
    companyAddress: s.company_address || '',
    onboarded: !!s.onboarded,
    handoverTerms: s.handover_terms || DEFAULT_HANDOVER_TERMS,
    lifecycles: { ...DEFAULT_LIFECYCLES, ...(s.lifecycles || {}) },
    locations: (s.locations && s.locations.length) ? s.locations : [...DEFAULT_LOCATIONS],
    defaultLocation: s.default_location || null,
    departments: (s.departments && s.departments.length) ? s.departments : [...DEFAULT_DEPARTMENTS],
    specOptions: { ...DEFAULT_SPEC_OPTIONS, ...(s.spec_options || {}) },
    documentStorage: s.document_storage || { provider: 'local' },
    language: s.language || 'en',
    handoverTemplates,
    // First template = default (used by older callers that only read handoverTemplate).
    handoverTemplate,
  };
}

function validateLogo(logo) {
  if (logo == null) return;
  if (typeof logo !== 'string' || !logo.startsWith('data:image/')) {
    throw HttpError.badRequest('companyLogo must be a data:image/... URL');
  }
  if (logo.length > 400_000) throw HttpError.badRequest('Logo too large — keep it under ~300KB');
}

function validateLifecycles(lc) {
  if (lc == null) return;
  if (typeof lc !== 'object') throw HttpError.badRequest('lifecycles must be an object of category -> months');
  for (const [cat, months] of Object.entries(lc)) {
    const m = Number(months);
    if (!Number.isInteger(m) || m < 0 || m > 240) {
      throw HttpError.badRequest(`Lifecycle for ${cat} must be 0-240 months (0 = EOL tracking off)`);
    }
  }
}

function validateSpecOptions(so) {
  if (so == null) return;
  if (typeof so !== 'object') throw HttpError.badRequest('specOptions must be an object');
  for (const key of Object.keys(so)) {
    if (!['cpu', 'ram', 'storage'].includes(key)) throw HttpError.badRequest(`Unknown spec list "${key}"`);
    if (!Array.isArray(so[key]) || so[key].some((v) => typeof v !== 'string' || !v.trim() || v.length > 60)) {
      throw HttpError.badRequest(`Spec list "${key}" must be an array of short strings`);
    }
  }
}

async function saveSettings({
  companyName, companyLogo, companyAddress, onboarded, handoverTerms, lifecycles,
  locations, defaultLocation, specOptions, documentStorage, handoverTemplate,
  handoverTemplates, defaultTemplateId, departments, language,
}) {
  if (language !== undefined && language !== null && !/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(String(language))) {
    throw HttpError.badRequest('language must be a short code like "en" or "tr"');
  }
  if (companyName !== undefined && (!companyName || companyName.length > 80)) {
    throw HttpError.badRequest('companyName is required (max 80 chars)');
  }
  if (companyAddress !== undefined && companyAddress !== null && String(companyAddress).length > 200) {
    throw HttpError.badRequest('companyAddress too long (max 200 chars)');
  }
  if (handoverTerms !== undefined && handoverTerms !== null && handoverTerms.length > 8000) {
    throw HttpError.badRequest('handoverTerms too long (max 8000 chars)');
  }
  validateLogo(companyLogo);
  validateLifecycles(lifecycles);
  validateSpecOptions(specOptions);

  let templatesToSave = null;
  let defaultMirror = null;

  if (handoverTemplates !== undefined) {
    templatesToSave = sanitizeTemplatesArray(handoverTemplates);
  } else if (handoverTemplate !== undefined) {
    // Legacy single-template save: merge into the existing list's first entry (or create one).
    const current = await getSettings();
    const list = current.handoverTemplates.map((t) => ({ ...t }));
    const cleaned = sanitizeTemplate(handoverTemplate);
    const first = { ...list[0], ...cleaned, id: list[0].id, name: list[0].name || 'Standard' };
    list[0] = first;
    templatesToSave = list;
  } else if (defaultTemplateId) {
    // Promote an existing template to default without rewriting the whole list.
    const current = await getSettings();
    const list = current.handoverTemplates.map((t) => ({ ...t }));
    const idx = list.findIndex((t) => t.id === String(defaultTemplateId));
    if (idx < 0) throw HttpError.badRequest('defaultTemplateId does not match any template');
    if (idx > 0) {
      const [row] = list.splice(idx, 1);
      list.unshift(row);
    }
    templatesToSave = list;
  }

  if (templatesToSave && defaultTemplateId) {
    const idx = templatesToSave.findIndex((t) => t.id === String(defaultTemplateId));
    if (idx > 0) {
      const [row] = templatesToSave.splice(idx, 1);
      templatesToSave.unshift(row);
    } else if (idx < 0 && handoverTemplates !== undefined) {
      throw HttpError.badRequest('defaultTemplateId does not match any template in handoverTemplates');
    }
  }

  if (templatesToSave) defaultMirror = templatesToSave[0];

  await query(
    `UPDATE app_settings SET
       company_name   = COALESCE($1, company_name),
       company_logo   = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE company_logo END,
       onboarded      = COALESCE($3, onboarded),
       handover_terms = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE handover_terms END,
       lifecycles     = CASE WHEN $5::jsonb IS NOT NULL THEN $5 ELSE lifecycles END,
       locations      = CASE WHEN $6::jsonb IS NOT NULL THEN $6 ELSE locations END,
       default_location = CASE WHEN $7::text IS NOT NULL THEN NULLIF($7, '__none__') ELSE default_location END,
       spec_options   = CASE WHEN $8::jsonb IS NOT NULL THEN $8 ELSE spec_options END,
       document_storage = CASE WHEN $9::jsonb IS NOT NULL THEN $9 ELSE document_storage END,
       handover_template = CASE WHEN $10::jsonb IS NOT NULL THEN $10 ELSE handover_template END,
       departments    = CASE WHEN $11::jsonb IS NOT NULL THEN $11 ELSE departments END,
       language       = CASE WHEN $12::text IS NOT NULL THEN $12 ELSE language END,
       company_address = CASE WHEN $13::text IS NOT NULL THEN $13 ELSE company_address END,
       handover_templates = CASE WHEN $14::jsonb IS NOT NULL THEN $14 ELSE handover_templates END
     WHERE id = 1`,
    [companyName ?? null, companyLogo ?? null, onboarded ?? null, handoverTerms ?? null,
     lifecycles ? JSON.stringify(lifecycles) : null,
     locations ? JSON.stringify(locations.map((l) => String(l).trim()).filter(Boolean)) : null,
     defaultLocation === null ? '__none__' : (defaultLocation ?? null),
     specOptions ? JSON.stringify(specOptions) : null,
     documentStorage ? JSON.stringify(documentStorage) : null,
     defaultMirror ? JSON.stringify(defaultMirror) : null,
     departments ? JSON.stringify(departments.map((d) => String(d).trim()).filter(Boolean)) : null,
     language ?? null,
     companyAddress !== undefined ? String(companyAddress || '') : null,
     templatesToSave ? JSON.stringify(templatesToSave) : null]
  );
  return getSettings();
}

module.exports = {
  getSettings,
  saveSettings,
  resolveTemplate,
  normalizeTemplates,
  newTemplateId,
};
