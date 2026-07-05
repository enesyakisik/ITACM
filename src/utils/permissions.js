/** Role → UI permission map, shared by both auth providers. */
const ROLES = Object.freeze(['Admin', 'Helpdesk', 'Viewer']);

function buildPermissions(role) {
  return {
    canViewDashboard: true,
    canManageAssets: role === 'Admin' || role === 'Helpdesk',
    canExecuteHandovers: role === 'Admin' || role === 'Helpdesk',
    canManageMaintenance: role === 'Admin' || role === 'Helpdesk',
    canManageUsers: role === 'Admin',
  };
}

module.exports = { ROLES, buildPermissions };
