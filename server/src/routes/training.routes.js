const router = require('express').Router();
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const service = require('../services/training.service');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.use(auth);

router.get(
  '/',
  wrap(async (req, res) => {
    res.json({ trainings: await service.listActive() });
  })
);

router.get(
  '/admin',
  rbac('admin'),
  wrap(async (req, res) => {
    res.json({ trainings: await service.listAll() });
  })
);

router.post(
  '/',
  rbac('admin'),
  validate([
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
    body('description').optional().isLength({ max: 2000 }),
    body('category').optional().isLength({ max: 60 }),
    body('link').optional().isLength({ max: 500 }),
    body('startDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid start date'),
    body('endDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid end date'),
  ]),
  wrap(async (req, res) => {
    res.status(201).json({ training: await service.create(req.user.id, req.body) });
  })
);

router.patch(
  '/:id',
  rbac('admin'),
  validate([param('id').isMongoId().withMessage('Invalid training id')]),
  wrap(async (req, res) => {
    res.json({ training: await service.update(req.params.id, req.body) });
  })
);

router.delete(
  '/:id',
  rbac('admin'),
  validate([param('id').isMongoId().withMessage('Invalid training id')]),
  wrap(async (req, res) => {
    await service.remove(req.params.id);
    res.json({ message: 'Training removed' });
  })
);

module.exports = router;
