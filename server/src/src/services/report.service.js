const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const { ApiError } = require('../middleware/errorHandler');
const { startOfDayUTC, utcDateKey } = require('../utils/dates');
const { scopedFilter, assertCanView } = require('../services/team.service');

const MAX_ROWS = 5000;

function dateFilter(from, to) {
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDayUTC(from);
    if (to) filter.date.$lte = startOfDayUTC(to);
  }
  return filter;
}

function leaveDateFilter(from, to) {
  const filter = {};
  if (from) filter.endDate = { $gte: startOfDayUTC(from) };
  if (to) filter.startDate = { $lte: startOfDayUTC(to) };
  return filter;
}

async function attendanceReport(actor, { from, to, status, userId } = {}) {
  const filter = { ...(await scopedFilter(actor)), ...dateFilter(from, to) };
  if (userId) {
    await assertCanView(actor, userId);
    filter.user = userId;
  }
  if (status) filter.status = status;
  if (from && to && startOfDayUTC(to) < startOfDayUTC(from)) {
    throw new ApiError(400, 'End date must be on or after the start date');
  }
  const rows = await Attendance.find(filter)
    .sort({ date: 1, createdAt: 1 })
    .limit(MAX_ROWS)
    .populate('user', 'employeeId email')
    .lean();
  const counts = { present: 0, absent: 0, 'half-day': 0, leave: 0 };
  for (const row of rows) {
    if (counts[row.status] !== undefined) counts[row.status] += 1;
  }
  return { rows, summary: { total: rows.length, ...counts } };
}

async function leaveReport(actor, { from, to, status, type, userId } = {}) {
  const filter = { ...(await scopedFilter(actor)), ...leaveDateFilter(from, to) };
  if (userId) {
    await assertCanView(actor, userId);
    filter.user = userId;
  }
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (from && to && startOfDayUTC(to) < startOfDayUTC(from)) {
    throw new ApiError(400, 'End date must be on or after the start date');
  }
  const rows = await LeaveRequest.find(filter)
    .sort({ startDate: 1 })
    .limit(MAX_ROWS)
    .populate('user', 'employeeId email')
    .populate('reviewedBy', 'employeeId email')
    .lean();
  const summary = { total: rows.length, days: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    summary.days += row.days || 0;
    summary[row.status] += 1;
  }
  return { rows, summary };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Prevent spreadsheet formula injection in exported cells.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\r\n');
}

function attendanceCsv({ rows }) {
  return toCsv(
    ['Employee ID', 'Email', 'Date', 'Check In', 'Check Out', 'Work Hours', 'Status'],
    rows.map((r) => [
      r.user?.employeeId || '',
      r.user?.email || '',
      utcDateKey(r.date),
      r.checkIn ? new Date(r.checkIn).toISOString() : '',
      r.checkOut ? new Date(r.checkOut).toISOString() : '',
      r.workHours ?? '',
      r.status,
    ])
  );
}

function leaveCsv({ rows }) {
  return toCsv(
    ['Employee ID', 'Email', 'Type', 'From', 'To', 'Working Days', 'Status', 'Remarks', 'Reviewed By', 'Reviewed At'],
    rows.map((r) => [
      r.user?.employeeId || '',
      r.user?.email || '',
      r.type,
      utcDateKey(r.startDate),
      utcDateKey(r.endDate),
      r.days ?? '',
      r.status,
      r.remarks || '',
      r.reviewedBy?.employeeId || '',
      r.reviewedAt ? new Date(r.reviewedAt).toISOString() : '',
    ])
  );
}

module.exports = { attendanceReport, leaveReport, attendanceCsv, leaveCsv };
