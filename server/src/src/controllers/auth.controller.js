const authService = require('../services/auth.service');
const env = require('../config/env');

const REFRESH_COOKIE = 'hr_refresh';

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'strict' : 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({
      message: 'Account created. Check your email for a verification link.',
      user,
    });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const user = await authService.verifyEmail(req.query.token);
    res.json({ message: 'Email verified. You can now sign in.', user });
  } catch (err) {
    next(err);
  }
}

async function resendVerification(req, res, next) {
  try {
    await authService.resendVerification(req.body.email);
    // Generic response regardless of whether the account exists (no enumeration).
    res.json({ message: 'If an unverified account exists for this email, a new link has been sent.' });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.login(req.body);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { accessToken, refreshToken, user } = await authService.refresh(
      req.cookies[REFRESH_COOKIE]
    );
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id, req.cookies[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: cookieOptions.path });
    res.json({ message: 'Signed out' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    await authService.requestPasswordReset(req.body.email);
    // Generic response: never reveal whether the account exists.
    res.json({
      message: 'If an account exists for this email, a password reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Password updated. You can now sign in with your new password.' });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword,
      req.cookies[REFRESH_COOKIE]
    );
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
};
