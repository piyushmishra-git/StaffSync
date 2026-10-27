const { app, request, loginAs } = require('./helpers');
const Attendance = require('../src/models/Attendance');
const LeaveRequest = require('../src/models/LeaveRequest');
const Notification = require('../src/models/Notification');
const Profile = require('../src/models/Profile');
const User = require('../src/models/User');

describe('admin account deletion', () => {
  it('deletes an employee and cascades their data', async () => {
    const admin = await loginAs({ role: 'admin' });
    const employee = await loginAs();
    const id = employee.user._id;

    // Give the employee attendance, leave, and notification rows to cascade.
    await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${employee.token}`);
    const start = '2035-03-05';
    await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: start, endDate: start, remarks: 'trip' });
    expect(await Attendance.countDocuments({ user: id })).toBe(1);
    expect(await LeaveRequest.countDocuments({ user: id })).toBe(1);

    const res = await request(app)
      .delete(`/api/profiles/${id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted.email).toBe(employee.user.email);

    // Account and all dependent rows are gone.
    expect(await User.countDocuments({ _id: id })).toBe(0);
    expect(await Profile.countDocuments({ user: id })).toBe(0);
    expect(await Attendance.countDocuments({ user: id })).toBe(0);
    expect(await LeaveRequest.countDocuments({ user: id })).toBe(0);
    expect(await Notification.countDocuments({ user: id })).toBe(0);

    // The deleted user can no longer sign in, and the admin view 404s.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: employee.user.email, password: 'Passw0rd1' });
    expect(login.status).toBe(401);
    const gone = await request(app)
      .get(`/api/profiles/${id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(gone.status).toBe(404);
  });

  it('allows deleting another admin account', async () => {
    const admin = await loginAs({ role: 'admin' });
    const otherAdmin = await loginAs({ role: 'admin' });
    const res = await request(app)
      .delete(`/api/profiles/${otherAdmin.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(await User.countDocuments({ _id: otherAdmin.user._id })).toBe(0);
  });

  it('rejects deleting your own account', async () => {
    const admin = await loginAs({ role: 'admin' });
    const res = await request(app)
      .delete(`/api/profiles/${admin.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
    expect(await User.countDocuments({ _id: admin.user._id })).toBe(1);
  });

  it('returns 404 for a nonexistent user', async () => {
    const admin = await loginAs({ role: 'admin' });
    const res = await request(app)
      .delete('/api/profiles/000000000000000000000000')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });
});
