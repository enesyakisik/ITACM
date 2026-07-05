const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { employeeService } = require('../services');

router.use(authenticate);

/** GET /api/employees — Employee Directory + Handover Employee Selector (all roles). */
router.get('/', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await employeeService.listEmployees(req.query) });
}));

/** POST /api/employees — add an employee (Admin/Helpdesk). */
router.post('/', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await employeeService.createEmployee(req.body) });
}));

/** GET /api/employees/:id/history — full device history of one employee (all roles). */
router.get('/:id/history', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await employeeService.getEmployeeHistory(req.params.id, req.query.limit) });
}));

/** PUT /api/employees/:id — edit / deactivate (blocked while assets are held) (Admin/Helpdesk). */
router.put('/:id', requireRole('Admin', 'Helpdesk'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await employeeService.updateEmployee(req.params.id, req.body) });
}));

module.exports = router;
