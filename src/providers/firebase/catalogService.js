/** Product catalog (firebase): brand/model lists that feed the asset form. */
const { db, COLLECTIONS } = require('./firebase');
const { HttpError } = require('../../utils/httpError');

const CATALOG = 'catalogModels';
const keyOf = (c, b, m) => `${c}|${b}|${m}`.toLowerCase();

async function listCatalog() {
  const snap = await db.collection(CATALOG).orderBy('category').get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.category + a.brand + a.model).localeCompare(b.category + b.brand + b.model));
}

async function addCatalogEntry({ category, brand, model }) {
  if (!category || !brand || !model) throw HttpError.badRequest('category, brand and model are required');
  const dupe = await db.collection(CATALOG).where('key', '==', keyOf(category, brand, model)).limit(1).get();
  if (!dupe.empty) throw HttpError.conflict(`${brand} ${model} already exists in ${category}`);

  const ref = await db.collection(CATALOG).add({
    category: category.trim(), brand: brand.trim(), model: model.trim(),
    key: keyOf(category, brand, model),
  });
  return { id: ref.id, category, brand, model };
}

async function removeCatalogEntry(id) {
  await db.collection(CATALOG).doc(id).delete();
  return { id };
}

/** One-click bootstrap: pull every distinct category/brand/model already in inventory. */
async function importFromAssets() {
  const [assets, existing] = await Promise.all([
    db.collection(COLLECTIONS.ASSETS).select('category', 'brand', 'model').get(),
    db.collection(CATALOG).get(),
  ]);
  const have = new Set(existing.docs.map((d) => d.data().key));
  const batch = db.batch();
  let imported = 0;
  const seen = new Set();
  for (const doc of assets.docs) {
    const { category, brand, model } = doc.data();
    const key = keyOf(category, brand, model);
    if (have.has(key) || seen.has(key)) continue;
    seen.add(key);
    batch.set(db.collection(CATALOG).doc(), { category, brand, model, key });
    imported++;
    if (imported >= 400) break; // stay under batch limit
  }
  if (imported) await batch.commit();
  return { imported };
}

module.exports = { listCatalog, addCatalogEntry, removeCatalogEntry, importFromAssets };
