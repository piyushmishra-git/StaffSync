const router = require('express').Router();
const { param, query } = require('express-validator');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { uploadImage, uploadDocument } = require('../middleware/upload');
const controller = require('../controllers/profile.controller');

router.use(auth);

// Own profile (any authenticated user; employee-editable fields only)
router.get('/me', controller.getMe);
router.patch('/me', controller.updateMe);
router.post('/me/picture', uploadImage, controller.uploadPicture);
router.post('/me/documents', uploadDocument, controller.uploadDocument);

// Direct reports for managers
router.get(
  '/team',
  rbac('manager'),
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search is too long'),
  ]),
  controller.team
);

// Directory + profile lookup
router.get(
  '/',
  rbac('admin'),
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search is too long'),
  ]),
  controller.list
);
router.get(
  '/:userId',
  rbac('admin', 'manager'),
  validate([param('userId').isMongoId().withMessage('Invalid user id')]),
  controller.getOne
);
router.put(
  '/:userId',
  rbac('admin'),
  validate([param('userId').isMongoId().withMessage('Invalid user id')]),
  controller.updateOne
);
router.delete(
  '/:userId',
  rbac('admin'),
  validate([param('userId').isMongoId().withMessage('Invalid user id')]),
  controller.deleteOne
);

module.exports = router;
