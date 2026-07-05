const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { authProvider } = require('../services');
const { HttpError } = require('../utils/httpError');

// Brute-force protection: max 20 login attempts per IP per 15 minutes.
const loginAttempts = new Map();
function loginLimiter(req, res, next) {
  const now = Date.now();
  let entry = loginAttempts.get(req.ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 15 * 60 * 1000 };
    loginAttempts.set(req.ip, entry);
  }
  if (entry.count >= 20) {
    return next(HttpError.tooMany('Too many login attempts — wait 15 minutes and try again'));
  }
  entry.count++;
  if (loginAttempts.size > 10000) loginAttempts.clear(); // memory guard
  next();
}

/**
 * POST /api/auth/login — postgres mode only.
 * Body: { email, password } → { token, expiresIn, user }.
 * In firebase mode this returns 400 with instructions: login happens
 * client-side with the Firebase Web SDK.
 */
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const meta = { ip: req.ip, userAgent: req.headers['user-agent'] || null };
  res.json({ success: true, data: await authProvider.login(req.body || {}, meta) });
}));

/**
 * POST /api/auth/verify-token — works in both modes.
 * Send Authorization: Bearer <TOKEN>; returns the verified profile + UI permissions.
 * In firebase mode this handshake is also recorded as the login event.
 */
router.post('/verify-token', authenticate, asyncHandler(async (req, res) => {
  await authProvider.recordLogin(req.user, { ip: req.ip, userAgent: req.headers['user-agent'] || null });
  res.json({ success: true, data: await authProvider.getVerifiedProfile(req.user) });
}));

/** GET /api/auth/users — list IT users (Admin only). */
router.get('/users', authenticate, requireRole('Admin'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authProvider.listUsers() });
}));

/** POST /api/auth/users — onboard an IT user with a role (Admin only). */
router.post('/users', authenticate, requireRole('Admin'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await authProvider.createItUser(req.body) });
}));

/** PUT /api/auth/users/:uid/role — approve/change a role (Admin only). */
router.put('/users/:uid/role', authenticate, requireRole('Admin'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authProvider.setUserRole(req.params.uid, req.body.role) });
}));

/** GET /api/auth/users/:uid/logins — login history for a user (Admin only). */
router.get('/users/:uid/logins', authenticate, requireRole('Admin'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authProvider.getLoginLogs(req.params.uid, req.query.limit) });
}));

module.exports = router;
