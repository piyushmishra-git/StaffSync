const router = require('express').Router();
const { query } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const reportService = require('../services/report.service');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const filters = [
  query('from').optional().isISO8601().withMessage('Invalid from date'),
  query('to').optional().isISO8601().withMessage('Invalid to date'),
  query('userId').optional().isMongoId().withMessage('Invalid user id'),
  query('status').optional().isLength({ max: 20 }).withMessage('Invalid status'),
  query('type').optional().isIn(['paid', 'sick', 'unpaid']).withMessage('Invalid leave type'),
];

router.use(auth, rbac('admin', 'manager'));

router.get(
  '/attendance',
  validate(filters),
  wrap(async (req, res) => {
    const result = await reportService.attendanceReport(req.user, req.query);
    res.json(result);
  })
);

router.get(
  '/attendance.csv',
  validate(filters),
  wrap(async (req, res) => {
    const result = await reportService.attendanceReport(req.user, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-report-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(reportService.attendanceCsv(result));
  })
);

router.get(
  '/leaves',
  validate(filters),
  wrap(async (req, res) => {
    const result = await reportService.leaveReport(req.user, req.query);
    res.json(result);
  })
);

router.get(
  '/leaves.csv',
  validate(filters),
  wrap(async (req, res) => {
    const result = await reportService.leaveReport(req.user, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="leave-report-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(reportService.leaveCsv(result));
  })
);

module.exports = router;
