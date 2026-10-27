const { app, request, loginAs } = require('./helpers');

describe('monthly leave summary', () => {
  let employee;
  let admin;

  beforeAll(async () => {
    employee = await loginAs();
    admin = await loginAs({ role: 'admin' });

    // Approved leave spanning a month boundary: Jan 30 - Feb 3 (Thu, Fri, Mon).
    // Weekends are excluded from leave consumption.
    const created = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: '2031-01-30', endDate: '2031-02-03' });
    await request(app)
      .patch(`/api/leaves/${created.body.request._id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'approved' });
  });

  it('gives the employee their own counts, split by month, newest first', async () => {
    const res = await request(app)
      .get('/api/attendance/me/leave-summary')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(200);
    expect(res.body.months).toEqual([
      { year: 2031, month: 2, days: 1 },
      { year: 2031, month: 1, days: 2 },
    ]);
  });

  it('gives the admin the same counts for that user', async () => {
    const res = await request(app)
      .get(`/api/attendance/leave-summary/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.months).toEqual([
      { year: 2031, month: 2, days: 1 },
      { year: 2031, month: 1, days: 2 },
    ]);
  });

  it('returns an empty list for a user with no leaves', async () => {
    const res = await request(app)
      .get('/api/attendance/me/leave-summary')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.months).toEqual([]);
  });

  it('400s on a malformed user id', async () => {
    const res = await request(app)
      .get('/api/attendance/leave-summary/not-an-id')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });
});
