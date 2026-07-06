/** PostgreSQL (self-hosted) provider bundle: local JWT auth + Postgres storage. */
module.exports = {
  authProvider: require('./authProvider'),
  assetService: require('./assetService'),
  handoverService: require('./handoverService'),
  maintenanceService: require('./maintenanceService'),
  dashboardService: require('./dashboardService'),
  employeeService: require('./employeeService'),
  licenseService: require('./licenseService'),
  consumableService: require('./consumableService'),
  settingsService: require('./settingsService'),
  documentService: require('./documentService'),
  catalogService: require('./catalogService'),
  ensureDatabase: () => require('./migrate').ensureDatabase(),
};
