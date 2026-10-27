const router = require('express').Router();
const { body, param, query } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const attendanceService = require('../services/attendance.service');
const { assertCanView } = require('../services/team.service');
const { pagination } = require('../utils/query');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.use(auth);

// Employee: identity always taken from the verified JWT, never from params.
router.post(
  '/check-in',
  wrap(async (req, res) => {
    const record = await attendanceService.checkIn(req.user.id);
    res.status(201).json({ record });
  })
);

router.post(
  '/check-out',
  wrap(async (req, res) => {
    const record = await attendanceService.checkOut(req.user.id);
    res.json({ record });
  })
);

router.get(
  '/me',
  validate([
    query('from').optional().isISO8601().withMessage('Invalid from date'),
    query('to').optional().isISO8601().withMessage('Invalid to date'),
  ]),
  wrap(async (req, res) => {
    const records = await attendanceService.listOwn(req.user.id, req.query);
    res.json({ records });
  })
);

router.get(
  '/me/leave-summary',
  wrap(async (req, res) => {
    const result = await attendanceService.monthlyLeaveSummary(req.user.id);
    res.json(result);
  })
);

// Admin / manager: workforce-wide or team-scoped visibility.
router.get(
  '/',
  rbac('admin', 'manager'),
  validate([
    query('status').optional().isIn(['present', 'absent', 'half-day', 'leave']).withMessage('Invalid status'),
    query('from').optional().isISO8601().withMessage('Invalid from date'),
    query('to').optional().isISO8601().withMessage('Invalid to date'),
    query('userId').optional().isMongoId().withMessage('Invalid user id'),
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
  ]),
  wrap(async (req, res) => {
    const { page, limit } = pagination(req.query, { defaultLimit: 20 });
    const result = await attendanceService.listForActor(req.user, {
      ...req.query,
      page,
      limit,
    });
    res.json(result);
  })
);

router.get(
  '/leave-summary/:userId',
  rbac('admin', 'manager'),
  validate([param('userId').isMongoId().withMessage('Invalid user id')]),
  wrap(async (req, res) => {
    await assertCanView(req.user, req.params.userId);
    const result = await attendanceService.monthlyLeaveSummary(req.params.userId);
    res.json(result);
  })
);

router.post(
  '/mark-absentees',
  rbac('admin'),
  wrap(async (req, res) => {
    const result = await attendanceService.markAbsentees(req.body.date || new Date());
    res.json(result);
  })
);

router.patch(
  '/:id',
  rbac('admin'),
  validate([
    param('id').isMongoId().withMessage('Invalid attendance id'),
    body('status').optional().isIn(['present', 'absent', 'half-day', 'leave']),
  ]),
  wrap(async (req, res) => {
    const record = await attendanceService.adminUpdate(req.params.id, req.body);
    res.json({ record });
  })
);

module.exports = router;
