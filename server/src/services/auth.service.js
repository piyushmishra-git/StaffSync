const User = require('../models/User');
const env = require('../config/env');
const { ApiError } = require('../middleware/errorHandler');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  sha256,
  randomToken,
} = require('../utils/jwt');

const VERIFICATION_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

async function register({ employeeId, email, password }) {
  const existing = await User.findOne({ $or: [{ email }, { employeeId: employeeId.toUpperCase() }] });
  if (existing) {
    throw new ApiError(409, 'An account with this email or employee ID already exists');
  }

  // Public registration is always an employee. Elevated roles are assigned
  // only by an admin through the employee-management endpoints.
  const user = new User({ employeeId, email, role: 'employee' });
  await user.setPassword(password);

  const token = randomToken();
  user.verificationTokenHash = sha256(token);
  user.verificationTokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  await user.save();

  // Every account gets a profile shell immediately so directory listings
  // and profile pages never have to special-case missing profiles.
  const Profile = require('../models/Profile');
  await Profile.create({ user: user._id });

  const verifyUrl = `${env.clientOrigin}/verify-email?token=${token}`;
  try {
    await sendVerificationEmail(user.email, verifyUrl);
  } catch (err) {
    // Roll back so the email/employeeId stay free for a retry; otherwise the
    // half-registered account could never verify or re-register.
    await Profile.deleteOne({ user: user._id });
    await User.deleteOne({ _id: user._id });
    console.error(`[auth] Verification email to ${user.email} failed: ${err.message}`);
    throw new ApiError(502, 'Could not send the verification email. Please try again.');
  }

  return user.toSafeJSON();
}

async function verifyEmail(token) {
  const user = await User.findOne({
    verificationTokenHash: sha256(token),
    verificationTokenExpires: { $gt: new Date() },
  }).select('+verificationTokenHash +verificationTokenExpires');
  if (!user) throw new ApiError(400, 'Verification link is invalid or has expired');

  // The token stays valid until it expires so repeat clicks on the same link
  // (browser prefetch, React StrictMode double-fire, user re-opening the mail)
  // keep succeeding instead of 400ing after the first hit.
  user.isEmailVerified = true;
  await user.save();
  return user.toSafeJSON();
}

async function resendVerification(email) {
  const user = await User.findOne({ email });
  // Stay silent for unknown or already-verified emails so this public
  // endpoint can't be used to probe which addresses have accounts.
  if (!user || user.isEmailVerified) return;

  const token = randomToken();
  user.verificationTokenHash = sha256(token);
  user.verificationTokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  await user.save();

  const verifyUrl = `${env.clientOrigin}/verify-email?token=${token}`;
  await sendVerificationEmail(user.email, verifyUrl);
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHashes');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email before signing in');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHashes.push(sha256(refreshToken));
  // Cap concurrent sessions per user.
  user.refreshTokenHashes = user.refreshTokenHashes.slice(-5);
  await user.save();

  return { accessToken, refreshToken, user: user.toSafeJSON() };
}

async function refresh(oldRefreshToken) {
  if (!oldRefreshToken) throw new ApiError(401, 'Refresh token missing');
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const oldHash = sha256(oldRefreshToken);
  const user = await User.findOne({ _id: payload.sub, refreshTokenHashes: oldHash }).select(
    '+refreshTokenHashes'
  );
  if (!user) throw new ApiError(401, 'Refresh token has been revoked');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated');

  // Rotation: invalidate the used token, issue a new pair.
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHashes = user.refreshTokenHashes.filter((h) => h !== oldHash);
  user.refreshTokenHashes.push(sha256(refreshToken));
  await user.save();

  return { accessToken, refreshToken, user: user.toSafeJSON() };
}

async function logout(userId, refreshToken) {
  if (!refreshToken) return;
  await User.updateOne(
    { _id: userId },
    { $pull: { refreshTokenHashes: sha256(refreshToken) } }
  );
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return user.toSafeJSON();
}

// Always returns successfully so the endpoint cannot be used to enumerate accounts.
async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user || !user.isActive) return;

  const token = randomToken();
  user.resetTokenHash = sha256(token);
  user.resetTokenExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  const resetUrl = `${env.clientOrigin}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    // Token remains valid until expiry; log the failure but keep the public
    // response generic so account existence is never leaked.
    console.error(`[auth] Password reset email to ${user.email} failed: ${err.message}`);
  }
}

async function resetPassword(token, password) {
  const user = await User.findOne({
    resetTokenHash: sha256(token),
    resetTokenExpires: { $gt: new Date() },
  }).select('+passwordHash +refreshTokenHashes +resetTokenHash +resetTokenExpires');
  if (!user) throw new ApiError(400, 'Reset link is invalid or has expired');

  await user.setPassword(password);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  // Password reset signs the account out everywhere.
  user.refreshTokenHashes = [];
  await user.save();
}

async function changePassword(userId, currentPassword, newPassword, currentRefreshToken) {
  const user = await User.findById(userId).select('+passwordHash +refreshTokenHashes');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  await user.setPassword(newPassword);
  // Invalidate every other session; keep the calling device signed in.
  const keepHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
  user.refreshTokenHashes = keepHash
    ? user.refreshTokenHashes.filter((h) => h === keepHash)
    : [];
  await user.save();
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
  logout,
  getMe,
  requestPasswordReset,
  resetPassword,
  changePassword,
};
