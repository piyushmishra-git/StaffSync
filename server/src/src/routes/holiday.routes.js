const router = require('express').Router();
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const holidayService = require('../services/holiday.service');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.use(auth);

router.get(
  '/',
  wrap(async (req, res) => {
    const holidays = await holidayService.list(req.query);
    res.json({ holidays });
  })
);

router.post(
  '/',
  rbac('admin'),
  validate([
    body('name').trim().notEmpty().withMessage('Holiday name is required').isLength({ max: 120 }),
    body('date').isISO8601().withMessage('A valid holiday date is required'),
  ]),
  wrap(async (req, res) => {
    const holiday = await holidayService.create(req.body);
    res.status(201).json({ holiday });
  })
);

router.delete(
  '/:id',
  rbac('admin'),
  validate([param('id').isMongoId().withMessage('Invalid holiday id')]),
  wrap(async (req, res) => {
    await holidayService.remove(req.params.id);
    res.json({ message: 'Holiday removed' });
  })
);

module.exports = router;
