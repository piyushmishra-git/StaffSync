const { verifyAccessToken } = require('../utils/jwt');
const { ApiError } = require('./errorHandler');
const User = require('../models/User');

// The JWT establishes identity, but role/active state is re-read from the DB
// so deactivation and role changes take effect immediately.
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Authentication required'));
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('role isActive').lean();
    if (!user) return next(new ApiError(401, 'Invalid or expired token'));
    if (!user.isActive) return next(new ApiError(403, 'This account has been deactivated'));
    req.user = { id: payload.sub, role: user.role };
    return next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = auth;
