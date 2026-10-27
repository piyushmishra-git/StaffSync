const { app, request, loginAs } = require('./helpers');
const Attendance = require('../src/models/Attendance');

describe('holiday-aware leave and balances', () => {
  let admin;
  let employee;

  beforeAll(async () => {
    admin = await loginAs({ role: 'admin' });
    employee = await loginAs();
  });

  it('lets admins manage holidays and exposes them to employees', async () => {
    const created = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Foundation Day', date: '2032-05-05' });
    expect(created.status).toBe(201);

    const employeeCreate = await request(app)
      .post('/api/holidays')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ name: 'Nope', date: '2032-05-06' });
    expect(employeeCreate.status).toBe(403);

    const list = await request(app)
      .get('/api/holidays?from=2032-05-01&to=2032-05-31')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(list.status).toBe(200);
    expect(list.body.holidays).toHaveLength(1);
    expect(list.body.holidays[0].name).toBe('Foundation Day');
  });

  it('counts only weekdays that are not holidays and syncs approval to attendance', async () => {
    const created = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: '2032-05-03', endDate: '2032-05-09' });
    expect(created.status).toBe(201);
    // Mon, Tue, Thu, Fri (Wed is a holiday, Sat/Sun are weekends).
    expect(created.body.request.days).toBe(4);

    const approved = await request(app)
      .patch(`/api/leaves/${created.body.request._id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'approved' });
    expect(approved.status).toBe(200);

    const leaveRows = await Attendance.find({ user: employee.user._id, status: 'leave' });
    expect(leaveRows).toHaveLength(4);
    expect(leaveRows.every((r) => r.checkIn === null && r.workHours === 0)).toBe(true);
  });

  it('rejects weekend-only ranges', async () => {
    const res = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: '2032-06-05', endDate: '2032-06-06' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no working days/);
  });

  it('reports balances and enforces entitlements on new requests', async () => {
    const balances = await request(app)
      .get('/api/leaves/balances?year=2032')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(balances.status).toBe(200);
    const paid = balances.body.balances.find((b) => b.type === 'paid');
    expect(paid.entitled).toBe(20);
    expect(paid.used).toBe(4);
    expect(paid.available).toBe(16);

    const setEntitlement = await request(app)
      .put(`/api/leaves/entitlements/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ year: 2032, entitlements: { paid: 3 } });
    expect(setEntitlement.status).toBe(200);
    const capped = setEntitlement.body.balances.find((b) => b.type === 'paid');
    expect(capped.entitled).toBe(3);
    expect(capped.available).toBe(0);

    const over = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: '2032-05-10', endDate: '2032-05-11' });
    expect(over.status).toBe(409);
    expect(over.body.error).toMatch(/Insufficient paid leave/);
  });

  it('counts pending requests against the available balance', async () => {
    const other = await loginAs();
    await request(app)
      .put(`/api/leaves/entitlements/${other.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ year: 2032, entitlements: { paid: 1 } });

    const first = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ type: 'paid', startDate: '2032-07-05', endDate: '2032-07-05' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ type: 'paid', startDate: '2032-07-06', endDate: '2032-07-06' });
    expect(second.status).toBe(409);
  });
});
