const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const sanitizeRequest = require('./middleware/sanitize');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Render/Heroku/Railway terminate TLS at their proxy; trust exactly one hop so
// req.ip (rate limiting) reflects the real client instead of the proxy.
if (env.isProd) app.set('trust proxy', 1);

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

// Single-service deployment: serve the built SPA from the API origin so the
// browser talks to /api on the same host and the SameSite=Strict refresh
// cookie stays first-party. Skipped automatically when the client is not built.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(clientIndex);
  });
}

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
