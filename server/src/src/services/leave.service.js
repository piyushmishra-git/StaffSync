const LeaveRequest = require('../models/LeaveRequest');
const LeaveEntitlement = require('../models/LeaveEntitlement');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { ApiError } = require('../middleware/errorHandler');
const {
  startOfDayUTC,
  addDaysUTC,
  eachWorkingDayUTC,
  yearStartUTC,
  yearEndUTC,
  utcDateKey,
} = require('../utils/dates');
const holidayService = require('./holiday.service');
const { notify, notifyAdmins } = require('./notification.service');
const { scopedFilter, assertCanView, assertCanManage } = require('./team.service');

const MAX_RANGE_DAYS = 60;
const ENTITLEMENT_TYPES = ['paid', 'sick'];
const DEFAULT_ENTITLEMENTS = { paid: 20, sick: 10 };

function parseRange(startDate, endDate) {
  const start = startOfDayUTC(startDate);
  const end = startOfDayUTC(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date range');
  }
  if (start > end) throw new ApiError(400, 'Start date must be on or before the end date');
  return { start, end };
}

function yearsInRange(start, end) {
  const years = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y += 1) years.push(y);
  return years;
}

// Working days for the intersection of [start,end] with the given calendar year.
function workingDaysInYear(start, end, year, holidayKeys) {
  const from = start > yearStartUTC(year) ? start : yearStartUTC(year);
  const to = end < yearEndUTC(year) ? end : yearEndUTC(year);
  if (from > to) return [];
  return eachWorkingDayUTC(from, to, holidayKeys);
}

async function entitledDays(userId, year, type) {
  const record = await LeaveEntitlement.findOne({ user: userId, year, type }).lean();
  return record ? record.days : DEFAULT_ENTITLEMENTS[type] ?? 0;
}

async function usageForYear(userId, type, year, holidayKeys, excludeId) {
  const filter = {
    user: userId,
    type,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: yearEndUTC(year) },
    endDate: { $gte: yearStartUTC(year) },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const requests = await LeaveRequest.find(filter).lean();

  let pending = 0;
  let approved = 0;
  for (const request of requests) {
    const days = workingDaysInYear(request.startDate, request.endDate, year, holidayKeys).length;
    if (request.status === 'pending') pending += days;
    else approved += days;
  }
  return { pending, approved };
}

async function assertBalance(userId, type, start, end, holidayKeys, excludeId) {
  if (!ENTITLEMENT_TYPES.includes(type)) return;
  const years = yearsInRange(start, end);
  for (const year of years) {
    const yearHolidays = await holidayService.keySetForRange(yearStartUTC(year), yearEndUTC(year));
    const requested = workingDaysInYear(start, end, year, holidayKeys).length;
    if (!requested) continue;
    const entitled = await entitledDays(userId, year, type);
    const { pending, approved } = await usageForYear(userId, type, year, yearHolidays, excludeId);
    const available = entitled - pending - approved;
    if (requested > available) {
      throw new ApiError(
        409,
        `Insufficient ${type} leave balance for ${year}: ${available} day(s) available, ${requested} requested`
      );
    }
  }
}

async function create(userId, { type, startDate, endDate, remarks }) {
  const { start, end } = parseRange(startDate, endDate);
  if (startOfDayUTC(addDaysUTC(start, MAX_RANGE_DAYS - 1)) < end) {
    throw new ApiError(400, `A single request may cover at most ${MAX_RANGE_DAYS} days`);
  }

  const overlap = await LeaveRequest.findOne({
    user: userId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).lean();
  if (overlap) {
    throw new ApiError(409, 'You already have a pending or approved leave overlapping these dates');
  }

  const holidayKeys = await holidayService.keySetForRange(start, end);
  const workingDays = eachWorkingDayUTC(start, end, holidayKeys);
  if (workingDays.length === 0) {
    throw new ApiError(400, 'The selected range contains no working days (weekends/holidays only)');
  }

  await assertBalance(userId, type, start, end, holidayKeys);

  const request = await LeaveRequest.create({
    user: userId,
    type,
    startDate: start,
    endDate: end,
    days: workingDays.length,
    remarks,
  });

  const user = await User.findById(userId).select('manager').lean();
  const range = `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;
  if (user?.manager) {
    await notify(user.manager, {
      message: `New ${type} leave request from your report (${range})`,
      type: 'leave',
      link: '/app/team/leaves',
    });
  }
  await notifyAdmins({
    message: `New ${type} leave request (${range})`,
    type: 'leave',
    link: '/admin/leaves',
  });

  return request.toObject();
}

async function listOwn(userId, { from, to }) {
  const filter = { user: userId };
  if (from && to) {
    filter.startDate = { $lte: startOfDayUTC(to) };
    filter.endDate = { $gte: startOfDayUTC(from) };
  }
  return LeaveRequest.find(filter).sort({ startDate: -1 }).limit(100).lean();
}

async function cancelOwn(userId, requestId) {
  const request = await LeaveRequest.findOne({ _id: requestId, user: userId });
  if (!request) throw new ApiError(404, 'Leave request not found');
  if (request.status !== 'pending') {
    throw new ApiError(409, 'Only pending requests can be cancelled');
  }
  await request.deleteOne();
}

async function adminList(actor, { status, type, from, to, userId, page = 1, limit = 15 }) {
  const filter = await scopedFilter(actor);
  if (userId) {
    await assertCanView(actor, userId);
    filter.user = userId;
  }
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (from || to) {
    filter.startDate = {};
    if (to) filter.startDate.$lte = startOfDayUTC(to);
    filter.endDate = {};
    if (from) filter.endDate.$gte = startOfDayUTC(from);
  }
  const [requests, total] = await Promise.all([
    LeaveRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'employeeId email')
      .populate('reviewedBy', 'employeeId email')
      .lean(),
    LeaveRequest.countDocuments(filter),
  ]);
  return { requests, total, page: Number(page), pages: Math.ceil(total / limit) || 1 };
}

// Approval materialises one 'leave' attendance row per working day, so
// weekends/holidays never consume leave and calendars/history agree.
async function decide(actor, requestId, { status, adminComment = '' }) {
  const request = await LeaveRequest.findById(requestId);
  if (!request) throw new ApiError(404, 'Leave request not found');
  if (String(request.user) === String(actor.id)) {
    throw new ApiError(400, 'You cannot decide your own leave request');
  }
  await assertCanManage(actor, request.user);
  if (request.status !== 'pending') {
    throw new ApiError(409, `This request was already ${request.status}`);
  }

  let workingDays = [];
  if (status === 'approved') {
    const holidayKeys = await holidayService.keySetForRange(request.startDate, request.endDate);
    workingDays = eachWorkingDayUTC(request.startDate, request.endDate, holidayKeys);
    if (workingDays.length === 0) {
      throw new ApiError(409, 'This request no longer contains any working days');
    }
    await assertBalance(
      request.user,
      request.type,
      request.startDate,
      request.endDate,
      holidayKeys,
      request._id
    );
    request.days = workingDays.length;
  }

  request.status = status;
  request.adminComment = adminComment;
  request.reviewedBy = actor.id;
  request.reviewedAt = new Date();
  await request.save();

  if (status === 'approved') {
    await Attendance.bulkWrite(
      workingDays.map((day) => ({
        updateOne: {
          filter: { user: request.user, date: day },
          update: {
            $set: { status: 'leave', checkIn: null, checkOut: null, workHours: 0 },
            $setOnInsert: { user: request.user, date: day },
          },
          upsert: true,
        },
      }))
    );
  }

  const range = `${request.startDate.toISOString().slice(0, 10)} → ${request.endDate
    .toISOString()
    .slice(0, 10)}`;
  await notify(request.user, {
    message: `Your leave request (${range}) was ${status}${adminComment ? `: "${adminComment}"` : ''}`,
    type: 'leave',
    link: '/app/leave',
  });

  return LeaveRequest.findById(requestId)
    .populate('user', 'employeeId email')
    .populate('reviewedBy', 'employeeId email')
    .lean();
}

async function balances(userId, year = new Date().getUTCFullYear()) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2200) {
    throw new ApiError(400, 'Invalid year');
  }
  const holidayKeys = await holidayService.keySetForRange(
    yearStartUTC(numericYear),
    yearEndUTC(numericYear)
  );
  const rows = [];
  for (const type of ENTITLEMENT_TYPES) {
    const entitled = await entitledDays(userId, numericYear, type);
    const { pending, approved } = await usageForYear(
      userId,
      type,
      numericYear,
      holidayKeys
    );
    rows.push({
      type,
      entitled,
      used: approved,
      pending,
      available: Math.max(0, entitled - approved - pending),
    });
  }
  return { year: numericYear, balances: rows };
}

async function setEntitlements(userId, year, entitlements) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2200) {
    throw new ApiError(400, 'Invalid year');
  }
  const user = await User.findById(userId).select('_id').lean();
  if (!user) throw new ApiError(404, 'User not found');

  const operations = ENTITLEMENT_TYPES.filter((type) => entitlements[type] !== undefined).map(
    (type) => {
      const days = Number(entitlements[type]);
      if (!Number.isFinite(days) || days < 0 || days > 366) {
        throw new ApiError(400, `${type} entitlement must be between 0 and 366 days`);
      }
      return {
        updateOne: {
          filter: { user: userId, year: numericYear, type },
          update: { $set: { days } },
          upsert: true,
        },
      };
    }
  );
  if (!operations.length) throw new ApiError(400, 'No entitlement values supplied');
  await LeaveEntitlement.bulkWrite(operations);
  return balances(userId, numericYear);
}

function holidayKeySet(dates) {
  return new Set(dates.map((d) => utcDateKey(d)));
}

module.exports = {
  create,
  listOwn,
  cancelOwn,
  adminList,
  decide,
  balances,
  setEntitlements,
  workingDaysInYear,
  usageForYear,
  entitledDays,
  ENTITLEMENT_TYPES,
  DEFAULT_ENTITLEMENTS,
  holidayKeySet,
};
