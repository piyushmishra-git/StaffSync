let lastVerifyUrl = null;
jest.mock('../src/utils/mailer', () => ({
  sendVerificationEmail: jest.fn(async (to, url) => {
    lastVerifyUrl = url;
  }),
}));

const { app, request } = require('./helpers');
const User = require('../src/models/User');

describe('auth flow', () => {
  const creds = {
    employeeId: 'EMP900',
    email: 'flow@test.local',
    password: 'Str0ngPass',
    role: 'employee',
  };

  it('rejects weak passwords with field-level details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...creds, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details.some((d) => d.field === 'password')).toBe(true);
  });

  it('registers and sends a verification link', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user.isEmailVerified).toBe(false);
    expect(lastVerifyUrl).toMatch(/verify-email\?token=[0-9a-f]{64}/);
  });

  it('blocks login before verification', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(403);
  });

  it('verifies email and then allows login with role redirect data', async () => {
    const token = new URL(lastVerifyUrl).searchParams.get('token');
    const verify = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(verify.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.user.role).toBe('employee');
  });

  it('keeps the link valid for repeat clicks within the window', async () => {
    const token = new URL(lastVerifyUrl).searchParams.get('token');
    const res = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.isEmailVerified).toBe(true);
  });

  it('rejects the link after it expires', async () => {
    const token = new URL(lastVerifyUrl).searchParams.get('token');
    await User.updateOne(
      { email: creds.email },
      { verificationTokenExpires: new Date(Date.now() - 1000) }
    );
    const res = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or has expired/);
  });

  it('resends a fresh link for an unverified account', async () => {
    const stale = {
      employeeId: 'EMP910',
      email: 'resend@test.local',
      password: 'Str0ngPass',
      role: 'employee',
    };
    await request(app).post('/api/auth/register').send(stale);
    const firstUrl = lastVerifyUrl;
    await User.updateOne(
      { email: stale.email },
      { verificationTokenExpires: new Date(Date.now() - 1000) }
    );

    const resend = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: stale.email });
    expect(resend.status).toBe(200);
    expect(lastVerifyUrl).not.toBe(firstUrl);

    const token = new URL(lastVerifyUrl).searchParams.get('token');
    const verify = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(verify.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: stale.email, password: stale.password });
    expect(login.status).toBe(200);
  });

  it('returns the same generic response for unknown emails on resend', async () => {
    const before = lastVerifyUrl;
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'nobody@test.local' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an unverified account exists/);
    expect(lastVerifyUrl).toBe(before); // no mail sent
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
  });

  it('rejects bad credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
  });
});
