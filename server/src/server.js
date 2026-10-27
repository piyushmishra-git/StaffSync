const env = require('./config/env');
const { connectDb } = require('./config/db');
const app = require('./app');

async function main() {
  await connectDb();
  if (!env.isProd) {
    const { seedUsers } = require('./seed');
    await seedUsers();
  }
  require('./jobs/attendance.job').scheduleAttendanceJobs();
  await require('./utils/mailer').verifyMailer();
  app.listen(env.port, () => {
    console.log(`StaffSync API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
