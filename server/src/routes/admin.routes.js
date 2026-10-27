const router = require('express').Router();
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const employeeService = require('../services/employee.service');

router.use(auth, rbac('admin'));

const passwordRules = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[a-z]/)
  .withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter')
  .matches(/\d/)
  .withMessage('Password must contain a number');

router.get('/summary', async (req, res, next) => {
  try {
    const { startOfDayUTC } = require('../utils/dates');
    const [totalEmployees, totalManagers, totalAdmins, presentToday, pendingLeaves, inactive] =
      await Promise.all([
        User.countDocuments({ role: 'employee', isActive: true }),
        User.countDocuments({ role: 'manager', isActive: true }),
        User.countDocuments({ role: 'admin', isActive: true }),
        Attendance.countDocuments({
          date: startOfDayUTC(new Date()),
          status: { $in: ['present', 'half-day'] },
        }),
        LeaveRequest.countDocuments({ status: 'pending' }),
        User.countDocuments({ isActive: false }),
      ]);

    res.json({
      summary: {
        totalEmployees,
        totalManagers,
        totalAdmins,
        presentToday,
        pendingLeaves,
        inactive,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/managers', async (req, res, next) => {
  try {
    const managers = await employeeService.listManagers();
    res.json({ managers });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/employees',
  validate([
    body('employeeId').trim().notEmpty().withMessage('Employee ID is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    passwordRules,
    body('role').optional().isIn(employeeService.ROLES).withMessage('Invalid role'),
    body('managerId').optional({ nullable: true }).isMongoId().withMessage('Invalid manager id'),
    body('job.employmentType')
      .optional()
      .isIn(['full-time', 'part-time', 'contract', 'intern'])
      .withMessage('Invalid employment type'),
    body('personal.firstName').optional().isLength({ max: 80 }),
    body('personal.lastName').optional().isLength({ max: 80 }),
    body('personal.phone').optional().isLength({ max: 40 }),
    body('personal.address').optional().isLength({ max: 300 }),
  ]),
  async (req, res, next) => {
    try {
      const result = await employeeService.createEmployee(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/employees/:userId',
  validate([
    param('userId').isMongoId().withMessage('Invalid user id'),
    body('role').optional().isIn(employeeService.ROLES).withMessage('Invalid role'),
    body('managerId').optional({ nullable: true }).isMongoId().withMessage('Invalid manager id'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  ]),
  async (req, res, next) => {
    try {
      const user = await employeeService.updateEmployee(req.user, req.params.userId, req.body);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
