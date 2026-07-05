/** Firebase (managed) provider bundle: Firebase Auth + Firestore. */
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
  catalogService: require('./catalogService'),
};
