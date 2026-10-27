const router = require('express').Router();
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const service = require('../services/announcement.service');

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.use(auth);

router.get(
  '/',
  wrap(async (req, res) => {
    res.json({ announcements: await service.listActive(req.query) });
  })
);

router.get(
  '/admin',
  rbac('admin'),
  wrap(async (req, res) => {
    res.json({ announcements: await service.listAll() });
  })
);

router.post(
  '/',
  rbac('admin'),
  validate([
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
    body('body').trim().notEmpty().withMessage('Body is required').isLength({ max: 2000 }),
  ]),
  wrap(async (req, res) => {
    res.status(201).json({ announcement: await service.create(req.user.id, req.body) });
  })
);

router.patch(
  '/:id',
  rbac('admin'),
  validate([param('id').isMongoId().withMessage('Invalid announcement id')]),
  wrap(async (req, res) => {
    res.json({ announcement: await service.update(req.params.id, req.body) });
  })
);

router.delete(
  '/:id',
  rbac('admin'),
  validate([param('id').isMongoId().withMessage('Invalid announcement id')]),
  wrap(async (req, res) => {
    await service.remove(req.params.id);
    res.json({ message: 'Announcement removed' });
  })
);

module.exports = router;
