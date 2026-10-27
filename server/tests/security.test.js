jest.mock('../src/utils/mailer', () => ({
  sendVerificationEmail: jest.fn(async () => {}),
  sendPasswordResetEmail: jest.fn(async () => {}),
}));

const { app, request, loginAs } = require('./helpers');
const User = require('../src/models/User');

describe('security regressions', () => {
  it('ignores a client-supplied role on public registration (no privilege escalation)', async () => {
    const adminAttempt = await request(app).post('/api/auth/register').send({
      employeeId: 'ESC001',
      email: 'escalate@test.local',
      password: 'Str0ngPass',
      role: 'admin',
    });
    expect(adminAttempt.status).toBe(201);
    expect(adminAttempt.body.user.role).toBe('employee');

    const managerAttempt = await request(app).post('/api/auth/register').send({
      employeeId: 'ESC002',
      email: 'escalate2@test.local',
      password: 'Str0ngPass',
      role: 'manager',
    });
    expect(managerAttempt.status).toBe(201);
    expect(managerAttempt.body.user.role).toBe('employee');

    const stored = await User.findOne({ email: 'escalate@test.local' }).lean();
    expect(stored.role).toBe('employee');
  });

  it('drops Mongo operator objects from query strings instead of passing them to filters', async () => {
    const admin = await loginAs({ role: 'admin' });
    const tampered = await request(app)
      .get('/api/attendance?status[$ne]=absent&page[$gt]=0')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(tampered.status).toBe(200);
    expect(Array.isArray(tampered.body.records)).toBe(true);
  });

  it('escapes regex metacharacters in search terms', async () => {
    const admin = await loginAs({ role: 'admin' });
    await loginAs({ role: 'employee' });

    const wildcard = await request(app)
      .get('/api/profiles')
      .query({ search: '.*' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.total).toBe(0);

    const normal = await request(app)
      .get('/api/profiles')
      .query({ search: 't' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(normal.status).toBe(200);
    expect(normal.body.total).toBeGreaterThan(0);
  });

  it('rejects malformed pagination and date filters with 400', async () => {
    const admin = await loginAs({ role: 'admin' });

    const badPage = await request(app)
      .get('/api/attendance?page=abc')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(badPage.status).toBe(400);

    const badDate = await request(app)
      .get('/api/leaves?from=not-a-date')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(badDate.status).toBe(400);
  });

  it('does not pollute Object.prototype through query params', async () => {
    const admin = await loginAs({ role: 'admin' });
    await request(app)
      .get('/api/attendance?__proto__[polluted]=yes&constructor[prototype][polluted]=yes')
      .set('Authorization', `Bearer ${admin.token}`);
    expect({}.polluted).toBeUndefined();
  });
});
