const router = require('express').Router();
const { body, param, query } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const leaveService = require('../services/leave.service');
const { assertCanView } = require('../services/team.service');
const { pagination } = require('../utils/query');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.use(auth);

// Employee
router.post(
  '/',
  validate([
    body('type').isIn(['paid', 'sick', 'unpaid']).withMessage('Leave type must be paid, sick or unpaid'),
    body('startDate').isISO8601().withMessage('Start date is required'),
    body('endDate').isISO8601().withMessage('End date is required'),
    body('remarks').optional().isLength({ max: 500 }),
  ]),
  wrap(async (req, res) => {
    const request = await leaveService.create(req.user.id, req.body);
    res.status(201).json({ request });
  })
);

router.get(
  '/me',
  validate([
    query('from').optional().isISO8601().withMessage('Invalid from date'),
    query('to').optional().isISO8601().withMessage('Invalid to date'),
  ]),
  wrap(async (req, res) => {
    const requests = await leaveService.listOwn(req.user.id, req.query);
    res.json({ requests });
  })
);

router.get(
  '/balances',
  validate([query('year').optional().isInt({ min: 2000, max: 2200 }).withMessage('Invalid year')]),
  wrap(async (req, res) => {
    const result = await leaveService.balances(
      req.user.id,
      req.query.year || new Date().getUTCFullYear()
    );
    res.json(result);
  })
);

router.get(
  '/balances/:userId',
  rbac('admin', 'manager'),
  validate([param('userId').isMongoId().withMessage('Invalid user id')]),
  wrap(async (req, res) => {
    await assertCanView(req.user, req.params.userId);
    const result = await leaveService.balances(req.params.userId, req.query.year);
    res.json(result);
  })
);

router.put(
  '/entitlements/:userId',
  rbac('admin'),
  validate([
    param('userId').isMongoId().withMessage('Invalid user id'),
    body('year').isInt({ min: 2000, max: 2200 }).withMessage('A valid year is required'),
    body('entitlements').isObject().withMessage('Entitlements are required'),
  ]),
  wrap(async (req, res) => {
    const result = await leaveService.setEntitlements(
      req.params.userId,
      req.body.year,
      req.body.entitlements
    );
    res.json(result);
  })
);

router.delete(
  '/:id',
  validate([param('id').isMongoId().withMessage('Invalid leave id')]),
  wrap(async (req, res) => {
    await leaveService.cancelOwn(req.user.id, req.params.id);
    res.json({ message: 'Request cancelled' });
  })
);

// Admin / manager (manager requests are scoped to direct reports server-side)
router.get(
  '/',
  rbac('admin', 'manager'),
  validate([
    query('status').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status'),
    query('type').optional().isIn(['paid', 'sick', 'unpaid']).withMessage('Invalid type'),
    query('from').optional().isISO8601().withMessage('Invalid from date'),
    query('to').optional().isISO8601().withMessage('Invalid to date'),
    query('userId').optional().isMongoId().withMessage('Invalid user id'),
  ]),
  wrap(async (req, res) => {
    const { page, limit } = pagination(req.query, { defaultLimit: 15 });
    const result = await leaveService.adminList(req.user, { ...req.query, page, limit });
    res.json(result);
  })
);

router.patch(
  '/:id/decision',
  rbac('admin', 'manager'),
  validate([
    param('id').isMongoId().withMessage('Invalid leave id'),
    body('status').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
    body('adminComment').optional().isLength({ max: 500 }),
  ]),
  wrap(async (req, res) => {
    const request = await leaveService.decide(req.user, req.params.id, req.body);
    res.json({ request });
  })
);

module.exports = router;
