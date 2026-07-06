/**
 * Auth service — IT user provisioning and custom-claims role management.
 *
 * The role lives in TWO places, kept in sync here:
 *  1. Firebase Auth custom claims  -> embedded in the JWT, used for API authz
 *  2. users/{uid} Firestore doc    -> used for listings / UI display
 */
const { db, auth, FieldValue, COLLECTIONS, ROLES } = require('./firebase');
const { buildPermissions } = require('../../utils/permissions');
const { HttpError } = require('../../utils/httpError');

function assertValidRole(role) {
  if (!ROLES.includes(role)) {
    throw HttpError.badRequest(`Invalid role "${role}". Must be one of: ${ROLES.join(', ')}`);
  }
}

/**
 * Create a new IT user: Firebase Auth account + role custom claim + profile doc.
 * Used by Admins to onboard Helpdesk/Viewer/Admin staff.
 */
async function createItUser({ username, email, password, role }) {
  if (!username || !email || !password) {
    throw HttpError.badRequest('username, email and password are required');
  }
  assertValidRole(role);

  const userRecord = await auth
    .createUser({ email, password, displayName: username })
    .catch((err) => {
      if (err.code === 'auth/email-already-exists') {
        throw HttpError.conflict(`A user with email ${email} already exists`);
      }
      throw err;
    });

  await auth.setCustomUserClaims(userRecord.uid, { role });

  const profile = { username, email, role, createdAt: FieldValue.serverTimestamp() };
  await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(profile);

  return { uid: userRecord.uid, username, email, role };
}

/**
 * Change (or initially approve) an existing user's role.
 * Revokes refresh tokens so the old JWT cannot be replayed with stale claims.
 */
async function setUserRole(uid, role) {
  assertValidRole(role);

  const userRecord = await auth.getUser(uid).catch(() => {
    throw HttpError.notFound(`No Firebase Auth user with uid ${uid}`);
  });

  await auth.setCustomUserClaims(uid, { role });
  await db.collection(COLLECTIONS.USERS).doc(uid).set(
    {
      role,
      email: userRecord.email || null,
      username: userRecord.displayName || userRecord.email || uid,
    },
    { merge: true }
  );

  // Force clients to mint a fresh token carrying the new role claim.
  await auth.revokeRefreshTokens(uid);

  return { uid, role };
}

/**
 * Login handshake support: the client signs in with Email/Password via the
 * Firebase client SDK, then POSTs its ID token here. We return the verified
 * profile + permissions so the UI can configure itself.
 */
async function getVerifiedProfile(decodedUser) {
  const snap = await db.collection(COLLECTIONS.USERS).doc(decodedUser.uid).get();
  const profile = snap.exists ? snap.data() : {};

  const role = decodedUser.role;
  return {
    uid: decodedUser.uid,
    email: decodedUser.email,
    username: profile.username || decodedUser.email,
    role,
    permissions: buildPermissions(role),
  };
}

async function listUsers() {
  const snap = await db.collection(COLLECTIONS.USERS).orderBy('createdAt', 'desc').get();
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * Login audit (firebase mode): the client signs in with the Firebase SDK and
 * then calls POST /api/auth/verify-token — that handshake is recorded here.
 */
async function recordLogin(user, meta = {}) {
  await db.collection(COLLECTIONS.USERS).doc(user.uid).set(
    { lastLoginAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await db.collection('loginLogs').add({
    uid: user.uid,
    email: user.email || null,
    ip: meta.ip || null,
    userAgent: meta.userAgent || null,
    timestamp: FieldValue.serverTimestamp(),
  });
}

async function getLoginLogs(uid, limit = 25) {
  const snap = await db.collection('loginLogs')
    .where('uid', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(Math.min(Number(limit) || 25, 100))
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Onboarding: create the Admin account, or reset an existing one's credentials. */
async function upsertAdmin({ username, email, password }) {
  if (!username || !email || !password) {
    throw HttpError.badRequest('username, email and password are required');
  }
  try {
    return await createItUser({ username, email, password, role: 'Owner' });
  } catch (err) {
    if (err.status !== 409) throw err;
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName: username });
    await auth.setCustomUserClaims(existing.uid, { role: 'Owner' });
    await db.collection(COLLECTIONS.USERS).doc(existing.uid).set(
      { username, email, role: 'Owner' },
      { merge: true }
    );
    await auth.revokeRefreshTokens(existing.uid);
    return { uid: existing.uid, username, email, role: 'Owner' };
  }
}

module.exports = {
  createItUser, upsertAdmin, setUserRole, getVerifiedProfile, listUsers, recordLogin, getLoginLogs,
};
