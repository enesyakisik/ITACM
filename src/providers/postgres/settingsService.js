/** App settings (postgres): company branding, handover terms, onboarding flag. */
const { query } = require('./pool');
const { HttpError } = require('../../utils/httpError');
const { DEFAULT_HANDOVER_TERMS, DEFAULT_LIFECYCLES, DEFAULT_LOCATIONS, DEFAULT_SPEC_OPTIONS } = require('../../utils/defaults');


async function getSettings() {
  const { rows } = await query(
    'SELECT company_name, company_logo, onboarded, handover_terms, lifecycles, locations, default_location, spec_options, document_storage FROM app_settings WHERE id = 1'
  );
  const s = rows[0] || {};
  return {
    companyName: s.company_name || 'IT Asset Control Pro',
    companyLogo: s.company_logo || null,
    onboarded: !!s.onboarded,
    handoverTerms: s.handover_terms || DEFAULT_HANDOVER_TERMS,
    lifecycles: { ...DEFAULT_LIFECYCLES, ...(s.lifecycles || {}) },
    locations: (s.locations && s.locations.length) ? s.locations : [...DEFAULT_LOCATIONS],
    defaultLocation: s.default_location || null,
    specOptions: { ...DEFAULT_SPEC_OPTIONS, ...(s.spec_options || {}) },
    documentStorage: s.document_storage || { provider: 'local' },
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
    if (!Number.isInteger(m) || m < 1 || m > 240) {
      throw HttpError.badRequest(`Lifecycle for ${cat} must be 1-240 months`);
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

async function saveSettings({ companyName, companyLogo, onboarded, handoverTerms, lifecycles, locations, defaultLocation, specOptions, documentStorage }) {
  if (companyName !== undefined && (!companyName || companyName.length > 80)) {
    throw HttpError.badRequest('companyName is required (max 80 chars)');
  }
  if (handoverTerms !== undefined && handoverTerms !== null && handoverTerms.length > 8000) {
    throw HttpError.badRequest('handoverTerms too long (max 8000 chars)');
  }
  validateLogo(companyLogo);
  validateLifecycles(lifecycles);
  validateSpecOptions(specOptions);

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
       document_storage = CASE WHEN $9::jsonb IS NOT NULL THEN $9 ELSE document_storage END
     WHERE id = 1`,
    [companyName ?? null, companyLogo ?? null, onboarded ?? null, handoverTerms ?? null,
     lifecycles ? JSON.stringify(lifecycles) : null,
     locations ? JSON.stringify(locations.map((l) => String(l).trim()).filter(Boolean)) : null,
     defaultLocation === null ? '__none__' : (defaultLocation ?? null),
     specOptions ? JSON.stringify(specOptions) : null,
     documentStorage ? JSON.stringify(documentStorage) : null]
  );
  return getSettings();
}

module.exports = { getSettings, saveSettings };
