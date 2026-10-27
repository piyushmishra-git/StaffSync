const Profile = require('../models/Profile');
const User = require('../models/User');
const { ApiError } = require('../middleware/errorHandler');
const { notify } = require('./notification.service');
const { parseSalaryFields } = require('../utils/salary');
const { escapeRegex, pagination } = require('../utils/query');

function breakdown(salary = {}) {
  const basic = salary.basic || 0;
  const hra = salary.hra || 0;
  const allowances = salary.allowances || 0;
  const deductions = salary.deductions || 0;
  return {
    basic,
    hra,
    allowances,
    deductions,
    currency: salary.currency || 'INR',
    gross: basic + hra + allowances,
    net: basic + hra + allowances - deductions,
  };
}

// Employee view: strictly read-only. There is no employee write path to
// salary anywhere in the API - mutations live only on the admin routes.
async function getOwn(userId) {
  const profile = await Profile.findOne({ user: userId }).select('salary').lean();
  return breakdown(profile?.salary);
}

async function adminList({ page = 1, limit = 15, search = '' } = {}) {
  ({ page, limit } = pagination({ page, limit }, { defaultLimit: 15 }));
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
    .limit(Number(limit))
    .lean();
  const total = await User.countDocuments(userFilter);

  const profiles = await Profile.find({ user: { $in: users.map((u) => u._id) } })
    .select('user salary personal.firstName personal.lastName')
    .lean();
  const byUser = new Map(profiles.map((p) => [p.user.toString(), p]));

  const rows = users.map((u) => {
    const p = byUser.get(u._id.toString());
    return {
      user: { id: u._id, employeeId: u.employeeId, email: u.email, role: u.role },
      name: p ? `${p.personal?.firstName || ''} ${p.personal?.lastName || ''}`.trim() : '',
      salary: breakdown(p?.salary),
    };
  });

  return { rows, total, page: Number(page), pages: Math.ceil(total / limit) || 1 };
}

async function adminGet(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(404, 'User not found');
  const profile = await Profile.findOne({ user: userId }).select('salary').lean();
  return { user: { id: user._id, employeeId: user.employeeId, email: user.email }, salary: breakdown(profile?.salary) };
}

async function adminUpdate(userId, body) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const fields = parseSalaryFields(body, { requireAny: true });
  const set = {};
  for (const [key, value] of Object.entries(fields)) {
    set[`salary.${key}`] = value;
  }

  const profile = await Profile.findOneAndUpdate(
    { user: userId },
    { $set: set, $setOnInsert: { user: userId } },
    { returnDocument: 'after', upsert: true }
  ).lean();

  await notify(userId, {
    message: 'Your salary structure was updated by HR.',
    type: 'payroll',
    link: '/app/payroll',
  });

  return breakdown(profile.salary);
}

module.exports = { getOwn, adminList, adminGet, adminUpdate };
