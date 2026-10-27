const { app, request, loginAs, createUser, tokenFor } = require('./helpers');

describe('reports', () => {
  let admin;
  let employee;
  let manager;
  let managerToken;

  beforeAll(async () => {
    admin = await loginAs({ role: 'admin' });
    employee = await loginAs();
    const boss = await createUser({ role: 'manager' });
    manager = boss.user;
    managerToken = await tokenFor(manager, boss.password);

    // Direct report with attendance + approved leave.
    const report = await createUser({ manager: manager._id });
    const reportToken = await tokenFor(report.user, report.password);
    await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${reportToken}`);
    const leave = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${reportToken}`)
      .send({ type: 'sick', startDate: '2033-02-07', endDate: '2033-02-08' });
    await request(app)
      .patch(`/api/leaves/${leave.body.request._id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'approved', adminComment: 'Get well' });
  });

  it('returns attendance report data and CSV for admins', async () => {
    const json = await request(app)
      .get('/api/reports/attendance')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(json.status).toBe(200);
    expect(json.body.rows.length).toBeGreaterThan(0);
    expect(json.body.summary.total).toBe(json.body.rows.length);

    const csv = await request(app)
      .get('/api/reports/attendance.csv')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\r\n')[0]).toBe(
      'Employee ID,Email,Date,Check In,Check Out,Work Hours,Status'
    );
    expect(csv.text.split('\r\n').length).toBeGreaterThan(1);
  });

  it('filters the leave report by status and exports CSV', async () => {
    const json = await request(app)
      .get('/api/reports/leaves?status=approved&from=2033-02-01&to=2033-02-28')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(json.status).toBe(200);
    expect(json.body.rows.every((r) => r.status === 'approved')).toBe(true);
    expect(json.body.summary.approved).toBe(json.body.rows.length);

    const csv = await request(app)
      .get('/api/reports/leaves.csv?status=approved')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-disposition']).toMatch(/leave-report/);
    expect(csv.text).toContain('Employee ID,Email,Type,From,To,Working Days,Status');
  });

  it('scopes manager reports to direct reports', async () => {
    const attendance = await request(app)
      .get('/api/reports/attendance')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(attendance.status).toBe(200);
    const ids = new Set(attendance.body.rows.map((r) => r.user.employeeId));
    expect(ids.size).toBe(1);

    const foreign = await request(app)
      .get(`/api/reports/leaves?userId=${employee.user._id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(foreign.status).toBe(403);
  });

  it('blocks employees from reports', async () => {
    const res = await request(app)
      .get('/api/reports/attendance')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(403);
  });
});
