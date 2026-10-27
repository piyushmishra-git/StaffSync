const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const { ApiError } = require('../middleware/errorHandler');
const { startOfDayUTC, isWeekendUTC } = require('../utils/dates');
const { scopedFilter } = require('./team.service');

const HALF_DAY_THRESHOLD_HOURS = 4;

async function checkIn(userId) {
  const today = startOfDayUTC(new Date());
  const now = new Date();
  let previous;
  try {
    // Atomic upsert: under concurrent double-clicks either the $setOnInsert
    // wins exactly once or the unique {user,date} index raises E11000.
    previous = await Attendance.findOneAndUpdate(
      { user: userId, date: today },
      { $setOnInsert: { checkIn: now, status: 'present' } },
      { upsert: true, returnDocument: 'before' }
    );
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already checked in today');
    throw err;
  }
  if (previous) {
    if (previous.status === 'leave') throw new ApiError(409, 'You are on approved leave today');
    throw new ApiError(409, 'You have already checked in today');
  }
  return Attendance.findOne({ user: userId, date: today }).lean();
}

async function checkOut(userId) {
  const today = startOfDayUTC(new Date());
  const record = await Attendance.findOne({ user: userId, date: today });
  if (!record || !record.checkIn) throw new ApiError(400, 'Check in before checking out');
  if (record.checkOut) throw new ApiError(409, 'You have already checked out today');
  if (record.status === 'leave') throw new ApiError(409, 'You are on approved leave today');

  record.checkOut = new Date();
  record.workHours = Math.round(((record.checkOut - record.checkIn) / 36e5) * 100) / 100;
  record.status = record.workHours < HALF_DAY_THRESHOLD_HOURS ? 'half-day' : 'present';
  await record.save();
  return record.toObject();
}

// Employees can only ever see their own records: userId comes from the JWT.
async function listOwn(userId, { from, to }) {
  const filter = { user: userId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDayUTC(from);
    if (to) filter.date.$lte = startOfDayUTC(to);
  }
  return Attendance.find(filter).sort({ date: -1 }).limit(100).lean();
}

// Admin sees everything; a manager sees only their direct reports.
async function listForActor(actor, { from, to, userId, status, page = 1, limit = 20 }) {
  const filter = await scopedFilter(actor);
  if (userId) {
    if (actor.role !== 'admin') {
      // Force the scope to win; a manager cannot expand beyond direct reports.
      const allowed = filter.user.$in.map(String);
      if (!allowed.includes(String(userId))) {
        throw new ApiError(403, 'You can only access your direct reports');
      }
    }
    filter.user = userId;
  }
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDayUTC(from);
    if (to) filter.date.$lte = startOfDayUTC(to);
  }
  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('user', 'employeeId email')
      .lean(),
    Attendance.countDocuments(filter),
  ]);
  return { records, total, page: Number(page), pages: Math.ceil(total / limit) || 1 };
}

function parseOptionalTime(value, field) {
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ApiError(400, `Invalid ${field}`);
  return parsed;
}

// Keeps derived fields coherent: leave/absent rows never carry clock times,
// and present/half-day rows recompute hours and status from the timestamps.
async function adminUpdate(id, { status, checkIn, checkOut }) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Attendance record not found');
  const record = await Attendance.findById(id);
  if (!record) throw new ApiError(404, 'Attendance record not found');

  if (status === 'absent' || status === 'leave') {
    record.status = status;
    record.checkIn = null;
    record.checkOut = null;
    record.workHours = 0;
  } else {
    if (checkIn !== undefined) record.checkIn = parseOptionalTime(checkIn, 'check-in time');
    if (checkOut !== undefined) record.checkOut = parseOptionalTime(checkOut, 'check-out time');

    if (record.checkIn && record.checkOut) {
      const hours = (record.checkOut - record.checkIn) / 36e5;
      if (hours < 0) throw new ApiError(400, 'Check-out must be after check-in');
      record.workHours = Math.round(hours * 100) / 100;
    } else {
      record.workHours = 0;
    }

    if (status) {
      record.status = status;
    } else if (record.checkIn && record.checkOut) {
      record.status = record.workHours < HALF_DAY_THRESHOLD_HOURS ? 'half-day' : 'present';
    } else if (record.checkIn) {
      record.status = 'present';
    } else {
      record.status = 'absent';
    }
  }

  await record.save();
  return record.toObject();
}

// Month-by-month count of leave days. Attendance is the single source of
// truth for day states (approval materializes one 'leave' row per day), so a
// leave range spanning two months lands in the right buckets automatically.
async function monthlyLeaveSummary(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(404, 'User not found');
  const rows = await Attendance.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), status: 'leave' } },
    {
      $group: {
        _id: {
          year: { $year: { date: '$date', timezone: 'UTC' } },
          month: { $month: { date: '$date', timezone: 'UTC' } },
        },
        days: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
  ]);
  return { months: rows.map((r) => ({ year: r._id.year, month: r._id.month, days: r.days })) };
}

// End-of-day sweep: active employees/managers without a record for the day get
// a single bulk-inserted 'absent' row. Weekends, holidays, admins and
// deactivated accounts are skipped.
async function markAbsentees(forDate = new Date()) {
  const day = startOfDayUTC(forDate);
  if (Number.isNaN(day.getTime())) throw new ApiError(400, 'Invalid date');
  if (isWeekendUTC(day)) return { marked: 0, date: day, skipped: 'weekend' };
  const holiday = await Holiday.exists({ date: day });
  if (holiday) return { marked: 0, date: day, skipped: 'holiday' };

  const [allUsers, recorded] = await Promise.all([
    User.find({ role: { $in: ['employee', 'manager'] }, isActive: true }).select('_id').lean(),
    Attendance.find({ date: day }).select('user').lean(),
  ]);
  const recordedSet = new Set(recorded.map((r) => r.user.toString()));
  const missing = allUsers.filter((u) => !recordedSet.has(u._id.toString()));
  if (!missing.length) return { marked: 0, date: day };
  await Attendance.insertMany(
    missing.map((u) => ({ user: u._id, date: day, status: 'absent' })),
    { ordered: false }
  );
  return { marked: missing.length, date: day };
}

module.exports = {
  checkIn,
  checkOut,
  listOwn,
  listForActor,
  adminUpdate,
  monthlyLeaveSummary,
  markAbsentees,
};
