/**
 * Firebase auth provider — verifies Firebase ID tokens (JWT) whose role is
 * embedded in custom claims. Login itself happens client-side with the
 * Firebase Web SDK; the API only ever sees Bearer ID tokens.
 */
const { auth } = require('./firebase');
const authService = require('./authService');
const { ROLES } = require('../../utils/permissions');
const { HttpError } = require('../../utils/httpError');

async function verifyToken(idToken) {
  let decoded;
  try {
    // checkRevoked=true so disabled/revoked users are rejected immediately.
    decoded = await auth.verifyIdToken(idToken, true);
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      throw HttpError.unauthorized('ID token expired — refresh the token on the client');
    }
    if (err.code === 'auth/id-token-revoked' || err.code === 'auth/user-disabled') {
      throw HttpError.unauthorized('Session revoked — sign in again');
    }
    throw HttpError.unauthorized('Invalid ID token');
  }

  if (!decoded.role || !ROLES.includes(decoded.role)) {
    throw HttpError.forbidden('Account has no assigned role. Ask an Admin to approve your access.');
  }

  return {
    uid: decoded.uid,
    email: decoded.email || null,
    role: decoded.role,
    username: decoded.name || decoded.email || null,
  };
}

async function login() {
  throw HttpError.badRequest(
    'This deployment runs in Firebase mode: sign in on the client with the Firebase Web SDK ' +
      '(signInWithEmailAndPassword), then call the API with Authorization: Bearer <ID_TOKEN>.'
  );
}

module.exports = {
  verifyToken,
  login,
  recordLogin: authService.recordLogin,
  getLoginLogs: authService.getLoginLogs,
  createItUser: authService.createItUser,
  upsertAdmin: authService.upsertAdmin,
  setUserRole: authService.setUserRole,
  getVerifiedProfile: authService.getVerifiedProfile,
  listUsers: authService.listUsers,
};
