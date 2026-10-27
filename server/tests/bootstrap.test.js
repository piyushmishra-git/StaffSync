const User = require('../src/models/User');
const Profile = require('../src/models/Profile');
const { ensureBootstrapAdmin } = require('../src/seed');
const { createUser } = require('./helpers');

const ENV_KEYS = [
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_EMPLOYEE_ID',
];
const savedEnv = {};

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Profile.deleteMany({});
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('ensureBootstrapAdmin', () => {
  it('fails with a clear error when no admin exists and credentials are missing', async () => {
    await expect(ensureBootstrapAdmin()).rejects.toThrow(/BOOTSTRAP_ADMIN_EMAIL/);
    expect(await User.countDocuments()).toBe(0);
  });

  it('creates a verified, active admin with a profile shell', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = '  Founder@Example.com ';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Str0ngPass';
    process.env.BOOTSTRAP_ADMIN_EMPLOYEE_ID = ' boss01 ';

    const result = await ensureBootstrapAdmin();

    expect(result.created).toBe(true);
    const user = await User.findOne({ email: 'founder@example.com' }).select('+passwordHash');
    expect(user).not.toBeNull();
    expect(user.role).toBe('admin');
    expect(user.employeeId).toBe('BOSS01');
    expect(user.isActive).toBe(true);
    expect(user.isEmailVerified).toBe(true);
    expect(await user.comparePassword('Str0ngPass')).toBe(true);
    expect(await Profile.countDocuments({ user: user._id })).toBe(1);
  });

  it('does nothing when an admin already exists', async () => {
    await createUser({ role: 'admin' });
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'another@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Str0ngPass';

    const result = await ensureBootstrapAdmin();

    expect(result.created).toBe(false);
    expect(await User.countDocuments()).toBe(1);
    expect(await User.exists({ email: 'another@example.com' })).toBeNull();
  });

  it('rejects an invalid email or a weak password', async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'not-an-email';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Str0ngPass';
    await expect(ensureBootstrapAdmin()).rejects.toThrow(/valid email/);

    process.env.BOOTSTRAP_ADMIN_EMAIL = 'founder@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'weakpass';
    await expect(ensureBootstrapAdmin()).rejects.toThrow(/at least 8 characters/);
  });

  it('rejects an employee ID or email that already belongs to a non-admin', async () => {
    const { user } = await createUser({ role: 'employee', employeeId: 'EMP500' });

    process.env.BOOTSTRAP_ADMIN_EMAIL = 'founder@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'Str0ngPass';
    process.env.BOOTSTRAP_ADMIN_EMPLOYEE_ID = 'EMP500';
    await expect(ensureBootstrapAdmin()).rejects.toThrow(/already exists/);

    process.env.BOOTSTRAP_ADMIN_EMAIL = user.email;
    process.env.BOOTSTRAP_ADMIN_EMPLOYEE_ID = 'ADM999';
    await expect(ensureBootstrapAdmin()).rejects.toThrow(/already exists/);

    expect(await User.countDocuments()).toBe(1);
  });
});
