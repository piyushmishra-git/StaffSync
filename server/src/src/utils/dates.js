// All attendance records key on a UTC-midnight date so that one document
// exists per user per calendar day regardless of server timezone.
function startOfDayUTC(d) {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUTC(d, days) {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

// Inclusive list of UTC-midnight dates between start and end.
function eachDayUTC(start, end) {
  const days = [];
  let cursor = startOfDayUTC(start);
  const last = startOfDayUTC(end);
  while (cursor <= last) {
    days.push(cursor);
    cursor = addDaysUTC(cursor, 1);
  }
  return days;
}

function utcDateKey(d) {
  return startOfDayUTC(d).toISOString().slice(0, 10);
}

function isWeekendUTC(d) {
  const day = startOfDayUTC(d).getUTCDay();
  return day === 0 || day === 6;
}

function yearStartUTC(year) {
  return new Date(Date.UTC(year, 0, 1));
}

function yearEndUTC(year) {
  return new Date(Date.UTC(year, 11, 31));
}

// Weekdays only, excluding dates in the provided Set of YYYY-MM-DD keys.
function eachWorkingDayUTC(start, end, holidayKeys = new Set()) {
  return eachDayUTC(start, end).filter(
    (day) => !isWeekendUTC(day) && !holidayKeys.has(utcDateKey(day))
  );
}

module.exports = {
  startOfDayUTC,
  addDaysUTC,
  eachDayUTC,
  utcDateKey,
  isWeekendUTC,
  yearStartUTC,
  yearEndUTC,
  eachWorkingDayUTC,
};
