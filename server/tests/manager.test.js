const { app, request, createUser, loginAs, tokenFor } = require('./helpers');
const Attendance = require('../src/models/Attendance');

describe('manager role and team scoping', () => {
  let manager;
  let managerToken;
  let report;
  let outsider;
  let outsiderToken;

  beforeAll(async () => {
    const boss = await createUser({ role: 'manager' });
    manager = boss.user;
    managerToken = await tokenFor(manager, boss.password);

    const a = await createUser({ manager: manager._id });
    report = a.user;

    const b = await createUser();
    outsider = b.user;
    outsiderToken = await tokenFor(outsider, b.password);

    await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${await tokenFor(report, a.password)}`);
  });

  it('lists only direct reports', async () => {
    const res = await request(app)
      .get('/api/profiles/team')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].user.id).toBe(report._id.toString());
  });

  it('allows reading a direct report profile without salary or documents', async () => {
    const res = await request(app)
      .get(`/api/profiles/${report._id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.salary).toBeUndefined();
    expect(res.body.profile.documents).toBeUndefined();
  });

  it('denies profiles outside the team', async () => {
    const res = await request(app)
      .get(`/api/profiles/${outsider._id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it('scopes attendance lists to direct reports', async () => {
    const res = await request(app)
      .get('/api/attendance')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBeGreaterThan(0);
    expect(res.body.records.every((r) => r.user.employeeId === report.employeeId)).toBe(true);

    const foreign = await request(app)
      .get(`/api/attendance?userId=${outsider._id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(foreign.status).toBe(403);
  });

  it('denies attendance corrections, absentee sweeps, payroll and the full directory', async () => {
    const attendance = await Attendance.findOne({ user: report._id });
    const checks = [
      ['patch', `/api/attendance/${attendance._id}`, { status: 'present' }],
      ['post', '/api/attendance/mark-absentees', {}],
      ['get', '/api/payroll', null],
      ['get', '/api/profiles', null],
      ['post', '/api/admin/employees', { employeeId: 'X1', email: 'x1@test.local', password: 'Str0ngPass' }],
    ];
    for (const [method, url, payload] of checks) {
      const req = request(app)[method](url).set('Authorization', `Bearer ${managerToken}`);
      const res = payload ? await req.send(payload) : await req;
      expect([403, 400]).toContain(res.status);
    }
  });

  it('lets a manager decide a direct report leave request only', async () => {
    const own = await createUser({ manager: manager._id });
    const ownToken = await tokenFor(own.user, own.password);
    const created = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${ownToken}`)
      .send({ type: 'paid', startDate: '2032-04-05', endDate: '2032-04-05' });
    expect(created.status).toBe(201);

    const list = await request(app)
      .get('/api/leaves')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.requests.some((r) => r._id === created.body.request._id)).toBe(true);

    const outsiderLeave = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ type: 'paid', startDate: '2032-04-06', endDate: '2032-04-06' });
    expect(outsiderLeave.status).toBe(201);

    const denied = await request(app)
      .patch(`/api/leaves/${outsiderLeave.body.request._id}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'approved' });
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .patch(`/api/leaves/${created.body.request._id}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'approved' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.request.status).toBe('approved');
  });
});

describe('admin employee lifecycle', () => {
  it('creates a verified employee and assigns a manager', async () => {
    const admin = await loginAs({ role: 'admin' });
    const boss = await createUser({ role: 'manager' });
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        employeeId: 'NEW100',
        email: 'new100@test.local',
        password: 'Str0ngPass',
        role: 'employee',
        managerId: boss.user._id,
        personal: { firstName: 'New', lastName: 'Hire' },
        job: { designation: 'Analyst', department: 'Finance', employmentType: 'full-time' },
      });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('employee');
    expect(res.body.user.isEmailVerified).toBe(true);
    expect(res.body.user.manager).toBe(boss.user._id.toString());
    expect(res.body.profile.personal.firstName).toBe('New');

    // Admin-created accounts can sign in without the verification email step.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'new100@test.local', password: 'Str0ngPass' });
    expect(login.status).toBe(200);
  });

  it('deactivates an account and blocks login/refresh immediately', async () => {
    const admin = await loginAs({ role: 'admin' });
    const target = await loginAs({ role: 'employee' });

    const deactivate = await request(app)
      .patch(`/api/admin/employees/${target.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.user.isActive).toBe(false);

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ email: target.user.email, password: 'Passw0rd1' });
    expect(blocked.status).toBe(403);

    const staleToken = await request(app)
      .get('/api/attendance/me')
      .set('Authorization', `Bearer ${target.token}`);
    expect(staleToken.status).toBe(403);
  });

  it('prevents self-deactivation and role self-elevation shortcuts', async () => {
    const admin = await loginAs({ role: 'admin' });
    const selfDeactivate = await request(app)
      .patch(`/api/admin/employees/${admin.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(selfDeactivate.status).toBe(400);

    const selfRole = await request(app)
      .patch(`/api/admin/employees/${admin.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'employee' });
    expect(selfRole.status).toBe(400);
  });
});
