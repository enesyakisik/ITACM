/**
 * Provider selection — the only place that knows which backend is active.
 * Both providers expose an identical service interface, so routes and
 * middleware are 100% backend-agnostic.
 *
 * Lazy require: firebase-admin is only loaded in firebase mode, pg only in
 * postgres mode.
 */
const config = require('../config');

config.assertBackendConfig();

module.exports =
  config.backend === 'firebase'
    ? require('./firebase')
    : require('./postgres');
