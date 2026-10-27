const { app, request, loginAs } = require('./helpers');

describe('RBAC boundary', () => {
  let employee;
  let admin;

  beforeAll(async () => {
    employee = await loginAs({ role: 'employee' });
    admin = await loginAs({ role: 'admin' });
  });

  const adminOnly = [
    ['get', '/api/admin/summary'],
    ['get', '/api/profiles'],
    ['get', '/api/profiles/000000000000000000000000'],
    ['put', '/api/profiles/000000000000000000000000'],
    ['delete', '/api/profiles/000000000000000000000000'],
    ['get', '/api/attendance'],
    ['post', '/api/attendance/mark-absentees'],
    ['get', '/api/attendance/leave-summary/000000000000000000000000'],
    ['patch', '/api/attendance/000000000000000000000000'],
    ['get', '/api/leaves'],
    ['patch', '/api/leaves/000000000000000000000000/decision'],
    ['get', '/api/payroll'],
    ['get', '/api/payroll/000000000000000000000000'],
    ['put', '/api/payroll/000000000000000000000000'],
  ];

  it.each(adminOnly)('%s %s returns 403 for an employee token', async (method, url) => {
    const res = await request(app)[method](url).set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(403);
  });

  it.each(adminOnly)('%s %s returns 401 without a token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });

  it('admin passes the RBAC gate (summary 200)', async () => {
    const res = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.summary.totalEmployees).toBeGreaterThanOrEqual(1);
  });

  it('rejects a tampered token', async () => {
    const res = await request(app)
      .get('/api/profiles/me')
      .set('Authorization', `Bearer ${employee.token}x`);
    expect(res.status).toBe(401);
  });
});
