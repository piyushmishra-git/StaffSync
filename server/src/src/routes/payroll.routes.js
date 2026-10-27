const router = require('express').Router();
const { param, query } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const payrollService = require('../services/payroll.service');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.use(auth);

// Employee: read-only. No POST/PUT/PATCH exists on this path for employees.
router.get(
  '/me',
  wrap(async (req, res) => {
    const salary = await payrollService.getOwn(req.user.id);
    res.json({ salary });
  })
);

// Admin: full read/write over all payroll data.
router.get(
  '/',
  rbac('admin'),
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search is too long'),
  ]),
  wrap(async (req, res) => {
    const result = await payrollService.adminList(req.query);
    res.json(result);
  })
);

router.get(
  '/:userId',
  rbac('admin'),
  validate([param('userId').isMongoId().withMessage('Invalid user id')]),
  wrap(async (req, res) => {
    const result = await payrollService.adminGet(req.params.userId);
    res.json(result);
  })
);

router.put(
  '/:userId',
  rbac('admin'),
  validate([param('userId').isMongoId().withMessage('Invalid user id')]),
  wrap(async (req, res) => {
    const salary = await payrollService.adminUpdate(req.params.userId, req.body);
    res.json({ salary });
  })
);

module.exports = router;
