/** App settings (firebase): company branding + onboarding flag in settings/app. */
const { db, FieldValue } = require('./firebase');
const { HttpError } = require('../../utils/httpError');
const { DEFAULT_HANDOVER_TERMS, DEFAULT_LIFECYCLES, DEFAULT_LOCATIONS } = require('../../utils/defaults');


const REF = () => db.collection('settings').doc('app');

async function getSettings() {
  const snap = await REF().get();
  const s = snap.exists ? snap.data() : {};
  return {
    companyName: s.companyName || 'IT Asset Control Pro',
    companyLogo: s.companyLogo || null,
    onboarded: !!s.onboarded,
    handoverTerms: s.handoverTerms || DEFAULT_HANDOVER_TERMS,
    lifecycles: { ...DEFAULT_LIFECYCLES, ...(s.lifecycles || {}) },
    locations: (s.locations && s.locations.length) ? s.locations : [...DEFAULT_LOCATIONS],
    defaultLocation: s.defaultLocation || null,
  };
}

function validateLogo(logo) {
  if (logo == null) return;
  if (typeof logo !== 'string' || !logo.startsWith('data:image/')) {
    throw HttpError.badRequest('companyLogo must be a data:image/... URL');
  }
  if (logo.length > 400_000) throw HttpError.badRequest('Logo too large — keep it under ~300KB');
}

async function saveSettings({ companyName, companyLogo, onboarded, handoverTerms, lifecycles, locations, defaultLocation }) {
  if (companyName !== undefined && (!companyName || companyName.length > 80)) {
    throw HttpError.badRequest('companyName is required (max 80 chars)');
  }
  validateLogo(companyLogo);

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (companyName !== undefined) patch.companyName = companyName;
  if (companyLogo !== undefined && companyLogo !== null) patch.companyLogo = companyLogo;
  if (onboarded !== undefined) patch.onboarded = onboarded;
  if (handoverTerms !== undefined && handoverTerms !== null) {
    if (handoverTerms.length > 8000) throw HttpError.badRequest('handoverTerms too long (max 8000 chars)');
    patch.handoverTerms = handoverTerms;
  }

  if (lifecycles !== undefined && lifecycles !== null) {
    for (const [cat, months] of Object.entries(lifecycles)) {
      const m = Number(months);
      if (!Number.isInteger(m) || m < 1 || m > 240) {
        throw HttpError.badRequest(`Lifecycle for ${cat} must be 1-240 months`);
      }
    }
    patch.lifecycles = lifecycles;
  }

  if (locations !== undefined && locations !== null) {
    if (!Array.isArray(locations)) throw HttpError.badRequest('locations must be an array of strings');
    const clean = locations.map((l) => String(l).trim()).filter(Boolean);
    if (clean.length === 0) throw HttpError.badRequest('At least one location is required');
    patch.locations = clean;
  }

  if (defaultLocation !== undefined) patch.defaultLocation = defaultLocation;

  await REF().set(patch, { merge: true });
  return getSettings();
}

module.exports = { getSettings, saveSettings };
