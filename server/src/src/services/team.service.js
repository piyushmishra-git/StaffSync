const mongoose = require('mongoose');
const User = require('../models/User');
const { ApiError } = require('../middleware/errorHandler');

const ELEVATED = ['manager', 'admin'];

function validId(id) {
  return mongoose.isValidObjectId(id);
}

// Admin sees every employee; a manager sees only direct reports. Any other
// role is limited to their own records by their dedicated /me endpoints.
async function teamIds(managerId) {
  const users = await User.find({ manager: managerId }).select('_id').lean();
  return users.map((u) => u._id);
}

async function scopedFilter(actor, field = 'user') {
  if (actor.role === 'admin') return {};
  if (actor.role === 'manager') {
    return { [field]: { $in: await teamIds(actor.id) } };
  }
  return { [field]: actor.id };
}

async function getTarget(userId) {
  if (!validId(userId)) throw new ApiError(404, 'User not found');
  const target = await User.findById(userId).select('manager isActive role').lean();
  if (!target) throw new ApiError(404, 'User not found');
  return target;
}

async function canManage(actor, userId) {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'manager') return false;
  if (!validId(userId)) return false;
  const target = await getTarget(userId);
  return String(target.manager || '') === String(actor.id);
}

async function assertCanView(actor, userId) {
  if (actor.role === 'admin') {
    await getTarget(userId);
    return;
  }
  if (String(actor.id) === String(userId)) return;
  if (!(await canManage(actor, userId))) {
    throw new ApiError(403, 'You can only access your direct reports');
  }
}

async function assertCanManage(actor, userId) {
  if (actor.role === 'admin') {
    await getTarget(userId);
    return;
  }
  if (!(await canManage(actor, userId))) {
    throw new ApiError(403, 'You can only manage your direct reports');
  }
}

async function resolveManager(managerId) {
  if (managerId === null || managerId === undefined || managerId === '') return null;
  if (!validId(managerId)) throw new ApiError(400, 'Invalid manager');
  const manager = await User.findById(managerId).select('role isActive').lean();
  if (!manager || !ELEVATED.includes(manager.role)) {
    throw new ApiError(400, 'Manager must be an active manager or admin');
  }
  if (!manager.isActive) throw new ApiError(400, 'Manager must be an active manager or admin');
  return manager._id;
}

module.exports = {
  scopedFilter,
  teamIds,
  canManage,
  assertCanView,
  assertCanManage,
  resolveManager,
  validId,
};
