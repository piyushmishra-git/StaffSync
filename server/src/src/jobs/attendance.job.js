const cron = require('node-cron');
const { markAbsentees } = require('../services/attendance.service');

// End-of-day sweep at 23:55 server time: users with no attendance record
// for the day are bulk-marked absent (leave days already have records).
function scheduleAttendanceJobs() {
  cron.schedule('55 23 * * *', async () => {
    try {
      const { marked, date } = await markAbsentees(new Date());
      console.log(`[cron] Marked ${marked} absentee(s) for ${date.toISOString().slice(0, 10)}`);
    } catch (err) {
      console.error('[cron] Absentee sweep failed:', err.message);
    }
  });
}

module.exports = { scheduleAttendanceJobs };
