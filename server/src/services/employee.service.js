const User = require('../models/User');
const Profile = require('../models/Profile');
const { ApiError } = require('../middleware/errorHandler');
const { resolveManager, validId } = require('./team.service');
const { parseSalaryFields } = require('../utils/salary');

const ROLES = ['employee', 'manager', 'admin'];
const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'intern'];

function pickProfileFields(body = {}) {
  const personal = {};
  for (const key of ['firstName', 'lastName', 'phone', 'address', 'emergencyContact']) {
    if (body.personal?.[key] !== undefined) personal[key] = body.personal[key];
  }
  if (body.personal?.dob !== undefined) personal.dob = body.personal.dob;

  const job = {};
  for (const key of ['designation', 'department']) {
    if (body.job?.[key] !== undefined) job[key] = body.job[key];
  }
  if (body.job?.joiningDate !== undefined) job.joiningDate = body.job.joiningDate;
  if (body.job?.employmentType !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(body.job.employmentType)) {
      throw new ApiError(400, 'Invalid employment type');
    }
    job.employmentType = body.job.employmentType;
  }
  return { personal, job };
}

async function createEmployee({ employeeId, email, password, role = 'employee', managerId, ...profileBody }) {
  if (!ROLES.includes(role)) throw new ApiError(400, 'Invalid role');
  const existing = await User.findOne({
    $or: [{ email }, { employeeId: String(employeeId).toUpperCase() }],
  });
  if (existing) {
    throw new ApiError(409, 'An account with this email or employee ID already exists');
  }

  const manager = await resolveManager(managerId);
  const { personal, job } = pickProfileFields(profileBody);
  const salary = parseSalaryFields(profileBody.salary || {});

  const user = new User({
    employeeId,
    email,
    role,
    manager,
    isActive: true,
    isEmailVerified: true,
  });
  await user.setPassword(password);
  await user.save();

  const profile = await Profile.create({
    user: user._id,
    personal,
    job,
    salary: Object.keys(salary).length ? salary : undefined,
  });

  return { user: user.toSafeJSON(), profile };
}

async function updateEmployee(actor, userId, { role, managerId, isActive }) {
  if (!validId(userId)) throw new ApiError(404, 'User not found');
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const isSelf = String(user._id) === String(actor.id);
  if (isSelf && isActive === false) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }
  if (isSelf && role !== undefined && role !== user.role) {
    throw new ApiError(400, 'You cannot change your own role');
  }

  if (role !== undefined) {
    if (!ROLES.includes(role)) throw new ApiError(400, 'Invalid role');
    user.role = role;
  }
  if (managerId !== undefined) {
    const manager = await resolveManager(managerId);
    if (manager && String(manager) === String(user._id)) {
      throw new ApiError(400, 'An employee cannot manage themselves');
    }
    user.manager = manager;
  }
  if (isActive !== undefined) user.isActive = Boolean(isActive);

  await user.save();
  if (user.isActive === false) {
    // Revoke refresh sessions immediately; access tokens are checked against
    // the DB on every request and will fail too.
    await User.updateOne({ _id: user._id }, { $set: { refreshTokenHashes: [] } });
  }
  return user.toSafeJSON();
}

async function listManagers() {
  const users = await User.find({ role: { $in: ['manager', 'admin'] }, isActive: true })
    .sort({ employeeId: 1 })
    .select('employeeId email role')
    .lean();
  const profiles = await Profile.find({ user: { $in: users.map((u) => u._id) } })
    .select('user personal.firstName personal.lastName job.department')
    .lean();
  const byUser = new Map(profiles.map((p) => [p.user.toString(), p]));
  return users.map((u) => {
    const p = byUser.get(u._id.toString());
    return {
      id: u._id,
      employeeId: u.employeeId,
      email: u.email,
      role: u.role,
      name: p ? `${p.personal?.firstName || ''} ${p.personal?.lastName || ''}`.trim() : '',
      department: p?.job?.department || '',
    };
  });
}

module.exports = { ROLES, createEmployee, updateEmployee, listManagers };
