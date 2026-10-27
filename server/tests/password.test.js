let mockResetUrl = null;
jest.mock('../src/utils/mailer', () => ({
  sendVerificationEmail: jest.fn(async () => {}),
  sendPasswordResetEmail: jest.fn(async (to, url) => {
    mockResetUrl = url;
  }),
}));

const { app, request, loginAs } = require('./helpers');
const User = require('../src/models/User');

describe('password reset and change', () => {
  it('resets a forgotten password with a single-use token', async () => {
    const { user } = await loginAs();

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: user.email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.message).toMatch(/If an account exists/);
    expect(mockResetUrl).toMatch(/reset-password\?token=[0-9a-f]{64}/);

    const token = new URL(mockResetUrl).searchParams.get('token');
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'NewPass123' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Passw0rd1' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NewPass123' });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'Another123' });
    expect(reuse.status).toBe(400);
  });

  it('returns a generic success for unknown emails without sending mail', async () => {
    mockResetUrl = null;
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.local' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(mockResetUrl).toBeNull();
  });

  it('changes an authenticated password and keeps the current session usable', async () => {
    const session = await loginAs();

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ currentPassword: 'wrong', newPassword: 'Changed123' });
    expect(wrong.status).toBe(400);

    const changed = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${session.token}`)
      .send({ currentPassword: 'Passw0rd1', newPassword: 'Changed123' });
    expect(changed.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${session.token}`);
    expect(me.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: session.user.email, password: 'Passw0rd1' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: session.user.email, password: 'Changed123' });
    expect(newLogin.status).toBe(200);
  });

  it('stores reset tokens hashed, never in plaintext', async () => {
    const { user } = await loginAs();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const token = new URL(mockResetUrl).searchParams.get('token');
    const stored = await User.findById(user._id).select('+resetTokenHash +resetTokenExpires').lean();
    expect(stored.resetTokenHash).toBeTruthy();
    expect(stored.resetTokenHash).not.toBe(token);
    expect(stored.resetTokenExpires.getTime()).toBeGreaterThan(Date.now());
  });
});
