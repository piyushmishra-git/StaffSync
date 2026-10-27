const { app, request, loginAs } = require('./helpers');
const Attendance = require('../src/models/Attendance');

describe('consistency fixes', () => {
  it('validates salary identically in profile and payroll editors', async () => {
    const admin = await loginAs({ role: 'admin' });
    const employee = await loginAs();

    const negativeProfile = await request(app)
      .put(`/api/profiles/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ salary: { basic: -1 } });
    expect(negativeProfile.status).toBe(400);

    const badCurrency = await request(app)
      .put(`/api/profiles/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ salary: { currency: '1' } });
    expect(badCurrency.status).toBe(400);

    const negativePayroll = await request(app)
      .put(`/api/payroll/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ basic: -1 });
    expect(negativePayroll.status).toBe(400);

    const valid = await request(app)
      .put(`/api/profiles/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ salary: { basic: 1000, currency: 'inr' } });
    expect(valid.status).toBe(200);
    expect(valid.body.profile.salary.basic).toBe(1000);
    expect(valid.body.profile.salary.currency).toBe('INR');
  });

  it('keeps attendance timestamps, hours and status coherent on admin edits', async () => {
    const admin = await loginAs({ role: 'admin' });
    const employee = await loginAs();
    await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${employee.token}`);
    const record = await Attendance.findOne({ user: employee.user._id });

    const asLeave = await request(app)
      .patch(`/api/attendance/${record._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'leave' });
    expect(asLeave.status).toBe(200);
    expect(asLeave.body.record.checkIn).toBeNull();
    expect(asLeave.body.record.workHours).toBe(0);

    const checkIn = new Date('2032-08-02T09:00:00.000Z');
    const checkOut = new Date('2032-08-02T11:00:00.000Z');
    const times = await request(app)
      .patch(`/api/attendance/${record._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString() });
    expect(times.status).toBe(200);
    expect(times.body.record.status).toBe('half-day');
    expect(times.body.record.workHours).toBe(2);

    const reversed = await request(app)
      .patch(`/api/attendance/${record._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ checkIn: checkOut.toISOString(), checkOut: checkIn.toISOString() });
    expect(reversed.status).toBe(400);
  });

  it('clears stale clock times when leave is approved', async () => {
    const admin = await loginAs({ role: 'admin' });
    const employee = await loginAs();
    const day = new Date(Date.UTC(2032, 7, 2)); // Monday

    await Attendance.create({
      user: employee.user._id,
      date: day,
      checkIn: new Date('2032-08-02T09:00:00.000Z'),
      checkOut: new Date('2032-08-02T18:00:00.000Z'),
      workHours: 9,
      status: 'present',
    });

    const leave = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: '2032-08-02', endDate: '2032-08-02' });
    expect(leave.status).toBe(201);

    const approved = await request(app)
      .patch(`/api/leaves/${leave.body.request._id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'approved' });
    expect(approved.status).toBe(200);

    const updated = await Attendance.findOne({ user: employee.user._id, date: day }).lean();
    expect(updated.status).toBe('leave');
    expect(updated.checkIn).toBeNull();
    expect(updated.checkOut).toBeNull();
    expect(updated.workHours).toBe(0);
  });
});
