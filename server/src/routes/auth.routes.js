const router = require('express').Router();
const { body, query } = require('express-validator');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

const passwordRules = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[a-z]/)
  .withMessage('Password must contain a lowercase letter')
  .matches(/[A-Z]/)
  .withMessage('Password must contain an uppercase letter')
  .matches(/\d/)
  .withMessage('Password must contain a number');

router.post(
  '/register',
  validate([
    body('employeeId').trim().notEmpty().withMessage('Employee ID is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    passwordRules,
  ]),
  controller.register
);

router.get(
  '/verify-email',
  validate([query('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid token')]),
  controller.verifyEmail
);

router.post(
  '/resend-verification',
  validate([body('email').isEmail().withMessage('A valid email is required').normalizeEmail()]),
  controller.resendVerification
);

router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  controller.login
);

router.post('/refresh', controller.refresh);
router.post('/logout', auth, controller.logout);
router.get('/me', auth, controller.me);

router.post(
  '/forgot-password',
  validate([body('email').isEmail().withMessage('A valid email is required').normalizeEmail()]),
  controller.forgotPassword
);

router.post(
  '/reset-password',
  validate([
    body('token').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid reset token'),
    passwordRules,
  ]),
  controller.resetPassword
);

router.post(
  '/change-password',
  auth,
  validate([
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[a-z]/)
      .withMessage('Password must contain a lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/\d/)
      .withMessage('Password must contain a number'),  ]),
  controller.changePassword
);

module.exports = router;
