/** App settings (postgres): company branding, handover terms, onboarding flag. */
const { query } = require('./pool');
const { HttpError } = require('../../utils/httpError');
const { DEFAULT_HANDOVER_TERMS, DEFAULT_LIFECYCLES } = require('../../utils/defaults');

async function getSettings() {
  const { rows } = await query(
    'SELECT company_name, company_logo, onboarded, handover_terms, lifecycles FROM app_settings WHERE id = 1'
  );
  const s = rows[0] || {};
  return {
    companyName: s.company_name || 'IT Asset Control Pro',
    companyLogo: s.company_logo || null,
    onboarded: !!s.onboarded,
    handoverTerms: s.handover_terms || DEFAULT_HANDOVER_TERMS,
    lifecycles: { ...DEFAULT_LIFECYCLES, ...(s.lifecycles || {}) },
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

async function saveSettings({ companyName, companyLogo, onboarded, handoverTerms, lifecycles }) {
  if (companyName !== undefined && (!companyName || companyName.length > 80)) {
    throw HttpError.badRequest('companyName is required (max 80 chars)');
  }
  if (handoverTerms !== undefined && handoverTerms !== null && handoverTerms.length > 8000) {
    throw HttpError.badRequest('handoverTerms too long (max 8000 chars)');
  }
  validateLogo(companyLogo);
  validateLifecycles(lifecycles);

  await query(
    `UPDATE app_settings SET
       company_name   = COALESCE($1, company_name),
       company_logo   = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE company_logo END,
       onboarded      = COALESCE($3, onboarded),
       handover_terms = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE handover_terms END,
       lifecycles     = CASE WHEN $5::jsonb IS NOT NULL THEN $5 ELSE lifecycles END
     WHERE id = 1`,
    [companyName ?? null, companyLogo ?? null, onboarded ?? null, handoverTerms ?? null,
     lifecycles ? JSON.stringify(lifecycles) : null]
  );
  return getSettings();
}

module.exports = { getSettings, saveSettings };
