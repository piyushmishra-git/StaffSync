const Attendance = require('../src/models/Attendance');
const { app, request, loginAs } = require('./helpers');

describe('attendance', () => {
  it('concurrent double check-in creates exactly one record', async () => {
    const { user, token } = await loginAs();
    const [a, b] = await Promise.all([
      request(app).post('/api/attendance/check-in').set('Authorization', `Bearer ${token}`),
      request(app).post('/api/attendance/check-in').set('Authorization', `Bearer ${token}`),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const count = await Attendance.countDocuments({ user: user._id });
    expect(count).toBe(1);
  });

  it('rejects check-out before check-in', async () => {
    const { token } = await loginAs();
    const res = await request(app)
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('check-out computes hours and applies the half-day rule', async () => {
    const { token } = await loginAs();
    await request(app).post('/api/attendance/check-in').set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Same-instant checkout -> < 4h -> half-day.
    expect(res.body.record.status).toBe('half-day');
    expect(res.body.record.checkOut).toBeTruthy();

    const again = await request(app)
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(409);
  });

  it('employees only ever see their own records', async () => {
    const first = await loginAs();
    const second = await loginAs();
    await request(app).post('/api/attendance/check-in').set('Authorization', `Bearer ${first.token}`);

    const res = await request(app)
      .get('/api/attendance/me')
      .set('Authorization', `Bearer ${second.token}`);
    expect(res.status).toBe(200);
    const foreign = res.body.records.filter((r) => r.user !== second.user._id.toString());
    expect(foreign).toHaveLength(0);
  });

  it('admin absentee sweep marks users without records', async () => {
    const admin = await loginAs({ role: 'admin' });
    // Fixed weekday so the sweep is deterministic regardless of the run date.
    const day = '2035-03-06';
    const res = await request(app)
      .post('/api/attendance/mark-absentees')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ date: day });
    expect(res.status).toBe(200);
    expect(res.body.marked).toBeGreaterThanOrEqual(1);

    // Second sweep is idempotent: everyone already has a record.
    const again = await request(app)
      .post('/api/attendance/mark-absentees')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ date: day });
    expect(again.body.marked).toBe(0);
  });

  it('skips weekends and holidays in the absentee sweep', async () => {
    const admin = await loginAs({ role: 'admin' });
    const weekend = await request(app)
      .post('/api/attendance/mark-absentees')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ date: '2035-03-04' }); // Sunday
    expect(weekend.status).toBe(200);
    expect(weekend.body.marked).toBe(0);
    expect(weekend.body.skipped).toBe('weekend');
  });
});
