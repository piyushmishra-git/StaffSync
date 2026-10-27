const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const sanitizeRequest = require('./middleware/sanitize');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeRequest);

// Brute-force protection on the credential surface only.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
});
app.use('/api/auth', authLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/profiles', require('./routes/profile.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/leaves', require('./routes/leave.routes'));
app.use('/api/payroll', require('./routes/payroll.routes'));
app.use('/api/holidays', require('./routes/holiday.routes'));
app.use('/api/announcements', require('./routes/announcement.routes'));
app.use('/api/trainings', require('./routes/training.routes'));
app.use('/api/reports', require('./routes/report.routes'));

// Locally stored uploads (disk storage driver)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
