#!/usr/bin/env node
/**
 * Firebase-mode CLI: create IT users / manage role custom claims.
 * (In postgres mode the first Admin is seeded automatically and further users
 * are managed via POST /api/auth/users.)
 *
 * Usage:
 *   node scripts/setUserRole.js <email> <Admin|Helpdesk|Viewer>
 *   node scripts/setUserRole.js --create <email> <password> <username> <role>
 */
require('dotenv').config();

if ((process.env.DATA_BACKEND || 'postgres').toLowerCase() !== 'firebase') {
  console.error('This script is for DATA_BACKEND=firebase.');
  console.error('In postgres mode the Admin is auto-seeded; manage users via POST /api/auth/users.');
  process.exit(1);
}

const { auth } = require('../src/providers/firebase/firebase');
const authService = require('../src/providers/firebase/authService');

const ROLES = ['Admin', 'Helpdesk', 'Viewer'];

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--create') {
    const [, email, password, username, role] = args;
    if (!email || !password || !username || !ROLES.includes(role)) usage();
    const user = await authService.createItUser({ username, email, password, role });
    console.log(`Created ${role} user ${email} (uid: ${user.uid})`);
    return;
  }

  const [email, role] = args;
  if (!email || !ROLES.includes(role)) usage();

  const userRecord = await auth.getUserByEmail(email).catch(() => {
    console.error(`No Firebase Auth user found for ${email}`);
    process.exit(1);
  });

  await authService.setUserRole(userRecord.uid, role);
  console.log(`Set role "${role}" for ${email} (uid: ${userRecord.uid}).`);
  console.log('Existing refresh tokens were revoked — the user must sign in again.');
}

function usage() {
  console.error('Usage:');
  console.error('  node scripts/setUserRole.js <email> <Admin|Helpdesk|Viewer>');
  console.error('  node scripts/setUserRole.js --create <email> <password> <username> <role>');
  process.exit(1);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
