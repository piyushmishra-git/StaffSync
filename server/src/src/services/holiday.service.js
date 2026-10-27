const Holiday = require('../models/Holiday');
const { ApiError } = require('../middleware/errorHandler');
const { startOfDayUTC, utcDateKey } = require('../utils/dates');

async function list({ from, to } = {}) {
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDayUTC(from);
    if (to) filter.date.$lte = startOfDayUTC(to);
  }
  return Holiday.find(filter).sort({ date: 1 }).lean();
}

async function create({ name, date }) {
  const day = startOfDayUTC(date);
  if (Number.isNaN(day.getTime())) throw new ApiError(400, 'Invalid holiday date');
  return Holiday.create({ name, date: day });
}

async function remove(id) {
  const holiday = await Holiday.findByIdAndDelete(id);
  if (!holiday) throw new ApiError(404, 'Holiday not found');
  return holiday;
}

async function keySetForRange(start, end) {
  const holidays = await Holiday.find({
    date: { $gte: startOfDayUTC(start), $lte: startOfDayUTC(end) },
  })
    .select('date')
    .lean();
  return new Set(holidays.map((h) => utcDateKey(h.date)));
}

module.exports = { list, create, remove, keySetForRange };
