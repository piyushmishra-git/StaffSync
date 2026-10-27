/* Seeds a verified admin and sample employees for local development.
   Runs automatically on server boot in dev when the DB is empty,
   or standalone (with the API stopped) via: npm run seed */
const User = require('./models/User');
const Profile = require('./models/Profile');

const USERS = [
  {
    employeeId: 'ADM001', email: 'admin@hr-system.local', password: 'Admin@123', role: 'admin',
    profile: {
      personal: { firstName: 'Priya', lastName: 'Raman', phone: '+91 98400 00001', address: 'Chennai' },
      job: { designation: 'HR Manager', department: 'Human Resources', joiningDate: new Date('2022-01-10') },
      salary: { basic: 60000, hra: 24000, allowances: 10000, deductions: 6000 },
    },
  },
  {
    employeeId: 'MGR001', email: 'manager@hr-system.local', password: 'Manager@123', role: 'manager',
    profile: {
      personal: { firstName: 'Meera', lastName: 'Nair', phone: '+91 98400 00004', address: 'Pune' },
      job: { designation: 'Engineering Manager', department: 'Engineering', joiningDate: new Date('2021-09-01') },
      salary: { basic: 70000, hra: 28000, allowances: 12000, deductions: 7000 },
    },
  },
  {
    employeeId: 'EMP001', email: 'alice@hr-system.local', password: 'Alice@123', role: 'employee',
    managerEmail: 'manager@hr-system.local',
    profile: {
      personal: { firstName: 'Alice', lastName: 'Kumar', phone: '+91 98400 00002', address: 'Bengaluru' },
      job: { designation: 'Software Engineer', department: 'Engineering', joiningDate: new Date('2023-06-01') },
      salary: { basic: 45000, hra: 18000, allowances: 7000, deductions: 4500 },
    },
  },
  {
    employeeId: 'EMP002', email: 'bob@hr-system.local', password: 'Bob@12345', role: 'employee',
    managerEmail: 'manager@hr-system.local',
    profile: {
      personal: { firstName: 'Bob', lastName: 'Menon', phone: '+91 98400 00003', address: 'Kochi' },
      job: { designation: 'QA Analyst', department: 'Engineering', joiningDate: new Date('2024-02-15') },
      salary: { basic: 38000, hra: 15200, allowances: 5000, deductions: 3800 },
    },
  },
];

async function seedUsers() {
  for (const spec of USERS) {
    let user = await User.findOne({ email: spec.email });
    if (!user) {
      const manager = spec.managerEmail ? await User.findOne({ email: spec.managerEmail }) : null;
      user = new User({
        employeeId: spec.employeeId,
        email: spec.email,
        role: spec.role,
        manager: manager?._id || null,
      });
      await user.setPassword(spec.password);
      user.isEmailVerified = true;
      await user.save();
      console.log(`[seed] Created ${spec.role}: ${spec.email} / ${spec.password}`);
    } else if (spec.managerEmail && !user.manager) {
      const manager = await User.findOne({ email: spec.managerEmail });
      if (manager) {
        user.manager = manager._id;
        await user.save();
      }
    }
    await Profile.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id, ...spec.profile } },
      { upsert: true }
    );
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Production has no demo seed. Instead, the first boot creates one admin from
// BOOTSTRAP_ADMIN_* env vars; later boots are a no-op while an admin exists.
async function ensureBootstrapAdmin() {
  if (await User.exists({ role: 'admin' })) return { created: false };

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const employeeId = (process.env.BOOTSTRAP_ADMIN_EMPLOYEE_ID || 'ADM001').trim().toUpperCase();

  if (!email || !password) {
    throw new Error(
      'No admin account exists. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first admin.'
    );
  }
  if (!EMAIL_RE.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL is not a valid email address.');
  }
  if (!PASSWORD_RE.test(password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters and contain a lowercase letter, an uppercase letter and a number.'
    );
  }

  const conflict = await User.findOne({ $or: [{ email }, { employeeId }] });
  if (conflict) {
    throw new Error(
      `Cannot create the bootstrap admin: ${conflict.employeeId} / ${conflict.email} already exists with role "${conflict.role}" and no admin account exists. Promote it manually or choose different BOOTSTRAP_ADMIN_* values.`
    );
  }

  const user = new User({ employeeId, email, role: 'admin' });
  await user.setPassword(password);
  user.isEmailVerified = true;
  user.isActive = true;
  await user.save();
  await Profile.create({ user: user._id });
  console.log(`[bootstrap] Created first admin: ${email} (${employeeId})`);
  return { created: true, user };
}

module.exports = { seedUsers, ensureBootstrapAdmin };

if (require.main === module) {
  const { connectDb, disconnectDb } = require('./config/db');
  connectDb()
    .then(seedUsers)
    .then(disconnectDb)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
