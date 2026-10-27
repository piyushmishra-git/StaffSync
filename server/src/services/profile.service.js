const Profile = require('../models/Profile');
const User = require('../models/User');
const LeaveEntitlement = require('../models/LeaveEntitlement');
const storage = require('../utils/storage');
const { ApiError } = require('../middleware/errorHandler');
const { parseSalaryFields } = require('../utils/salary');
const { escapeRegex, pagination } = require('../utils/query');
const { assertCanView } = require('./team.service');

// The only fields an employee may change on their own profile.
const EMPLOYEE_EDITABLE = [
  'personal.firstName',
  'personal.lastName',
  'personal.dob',
  'personal.phone',
  'personal.address',
  'personal.emergencyContact',
];

const ADMIN_EDITABLE = [
  ...EMPLOYEE_EDITABLE,
  'job.designation',
  'job.department',
  'job.joiningDate',
  'job.employmentType',
];

// Fields hidden from managers: salary is HR/admin-only and documents are private.
const MANAGER_PROJECTION = '-salary -documents';

function pickPaths(body, allowedPaths) {
  const set = {};
  for (const path of allowedPaths) {
    const [section, field] = path.split('.');
    if (body?.[section] && Object.prototype.hasOwnProperty.call(body[section], field)) {
      set[path] = body[section][field];
    }
  }
  return set;
}

async function getOrCreate(userId) {
  const profile = await Profile.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { upsert: true, returnDocument: 'after' }
  ).populate('user', 'employeeId email role manager isActive');
  return profile;
}

async function updateOwn(userId, body) {
  const set = pickPaths(body, EMPLOYEE_EDITABLE);
  if (Object.keys(set).length === 0) {
    throw new ApiError(400, 'No editable fields supplied');
  }
  await getOrCreate(userId);
  return Profile.findOneAndUpdate({ user: userId }, { $set: set }, { returnDocument: 'after', runValidators: true })
    .populate('user', 'employeeId email role manager isActive');
}

async function adminUpdate(userId, body) {
  const set = pickPaths(body, ADMIN_EDITABLE);
  const salary = parseSalaryFields(body?.salary || {});
  for (const [key, value] of Object.entries(salary)) set[`salary.${key}`] = value;
  if (Object.keys(set).length === 0) {
    throw new ApiError(400, 'No editable fields supplied');
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  await getOrCreate(userId);
  return Profile.findOneAndUpdate({ user: userId }, { $set: set }, { returnDocument: 'after', runValidators: true })
    .populate('user', 'employeeId email role manager isActive');
}

async function adminGet(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return getOrCreate(userId);
}

async function getForActor(actor, userId) {
  if (actor.role === 'admin') return adminGet(userId);
  await assertCanView(actor, userId);
  const user = await User.findById(userId).select('_id').lean();
  if (!user) throw new ApiError(404, 'User not found');
  await getOrCreate(userId);
  return Profile.findOne({ user: userId })
    .select(MANAGER_PROJECTION)
    .populate('user', 'employeeId email role manager isActive');
}

async function adminDelete(actorId, userId) {
  if (String(userId) === String(actorId)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const Attendance = require('../models/Attendance');
  const LeaveRequest = require('../models/LeaveRequest');
  const Notification = require('../models/Notification');

  // User goes first so login/refresh dies immediately even if a cascade step fails.
  // Uploaded files (avatar/documents) are left in storage: the storage
  // abstraction has no remove() and orphaned files are harmless.
  await User.deleteOne({ _id: user._id });
  await Promise.all([
    Profile.deleteOne({ user: user._id }),
    Attendance.deleteMany({ user: user._id }),
    LeaveRequest.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    LeaveEntitlement.deleteMany({ user: user._id }),
    User.updateMany({ manager: user._id }, { $unset: { manager: 1 } }),
  ]);

  return { deleted: { id: user._id, employeeId: user.employeeId, email: user.email } };
}

function buildRows(users, profiles) {
  const byUser = new Map(profiles.map((p) => [p.user.toString(), p]));
  return users.map((u) => ({
    user: {
      id: u._id,
      employeeId: u.employeeId,
      email: u.email,
      role: u.role,
      manager: u.manager || null,
      isActive: u.isActive,
      isEmailVerified: u.isEmailVerified,
    },
    profile: byUser.get(u._id.toString()) || null,
  }));
}

async function adminList({ page = 1, limit = 10, search = '' } = {}) {
  ({ page, limit } = pagination({ page, limit }, { defaultLimit: 10 }));
  const userFilter = {};
  if (search) {
    const term = escapeRegex(String(search).trim().slice(0, 100));
    userFilter.$or = [
      { email: { $regex: term, $options: 'i' } },
      { employeeId: { $regex: term, $options: 'i' } },
    ];
  }
  const users = await User.find(userFilter)
    .sort({ employeeId: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const total = await User.countDocuments(userFilter);

  const profiles = await Profile.find({ user: { $in: users.map((u) => u._id) } })
    .select('-documents')
    .lean();

  return { rows: buildRows(users, profiles), total, page, pages: Math.ceil(total / limit) || 1 };
}

async function teamList(actor, { page = 1, limit = 10, search = '' } = {}) {
  ({ page, limit } = pagination({ page, limit }, { defaultLimit: 10 }));
  const filter = { manager: actor.id };
  if (search) {
    const term = escapeRegex(String(search).trim().slice(0, 100));
    filter.$or = [
      { email: { $regex: term, $options: 'i' } },
      { employeeId: { $regex: term, $options: 'i' } },
    ];
  }
  const users = await User.find(filter)
    .sort({ employeeId: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const total = await User.countDocuments(filter);
  const profiles = await Profile.find({ user: { $in: users.map((u) => u._id) } })
    .select(MANAGER_PROJECTION)
    .lean();
  return { rows: buildRows(users, profiles), total, page, pages: Math.ceil(total / limit) || 1 };
}

async function setPicture(userId, file) {
  if (!file) throw new ApiError(400, 'No file uploaded');
  const { url } = await storage.save({
    buffer: file.buffer,
    originalName: file.originalname,
    mime: file.mimetype,
    folder: 'avatars',
  });
  await getOrCreate(userId);
  return Profile.findOneAndUpdate({ user: userId }, { $set: { profilePictureUrl: url } }, { returnDocument: 'after' })
    .populate('user', 'employeeId email role manager isActive');
}

async function addDocument(userId, file, name) {
  if (!file) throw new ApiError(400, 'No file uploaded');
  const { url } = await storage.save({
    buffer: file.buffer,
    originalName: file.originalname,
    mime: file.mimetype,
    folder: 'documents',
  });
  await getOrCreate(userId);
  return Profile.findOneAndUpdate(
    { user: userId },
    { $push: { documents: { name: name || file.originalname, url } } },
    { returnDocument: 'after' }
  ).populate('user', 'employeeId email role manager isActive');
}

module.exports = {
  EMPLOYEE_EDITABLE,
  ADMIN_EDITABLE,
  getOrCreate,
  updateOwn,
  adminUpdate,
  adminGet,
  getForActor,
  adminDelete,
  adminList,
  teamList,
  setPicture,
  addDocument,
};
