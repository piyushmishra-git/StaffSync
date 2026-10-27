const Attendance = require('../src/models/Attendance');
const Notification = require('../src/models/Notification');
const { app, request, loginAs } = require('./helpers');

describe('leave workflow', () => {
  it('runs the full request -> approve -> attendance sync loop', async () => {
    const employee = await loginAs();
    const admin = await loginAs({ role: 'admin' });

    const created = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: '2030-03-04', endDate: '2030-03-06', remarks: 'Trip' });
    expect(created.status).toBe(201);
    const id = created.body.request._id;

    // Overlapping request is refused.
    const overlap = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'sick', startDate: '2030-03-06', endDate: '2030-03-07' });
    expect(overlap.status).toBe(409);

    // Employee cannot decide their own request.
    const selfDecide = await request(app)
      .patch(`/api/leaves/${id}/decision`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ status: 'approved' });
    expect(selfDecide.status).toBe(403);

    // Admin approves with a comment.
    const decided = await request(app)
      .patch(`/api/leaves/${id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'approved', adminComment: 'Have fun' });
    expect(decided.status).toBe(200);
    expect(decided.body.request.status).toBe('approved');
    expect(decided.body.request.reviewedBy.employeeId).toBe(admin.user.employeeId);

    // Attendance now carries one 'leave' record per day in the range.
    const days = await Attendance.find({ user: employee.user._id, status: 'leave' });
    expect(days).toHaveLength(3);

    // The employee was notified with the comment.
    const note = await Notification.findOne({ user: employee.user._id, type: 'leave' });
    expect(note.message).toContain('approved');
    expect(note.message).toContain('Have fun');

    // A decision is final.
    const again = await request(app)
      .patch(`/api/leaves/${id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'rejected' });
    expect(again.status).toBe(409);
  });

  it('validates the date range', async () => {
    const employee = await loginAs();
    const res = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'paid', startDate: '2030-05-10', endDate: '2030-05-08' });
    expect(res.status).toBe(400);
  });

  it('lets employees cancel only pending requests', async () => {
    const employee = await loginAs();
    const admin = await loginAs({ role: 'admin' });

    const created = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ type: 'unpaid', startDate: '2030-06-03', endDate: '2030-06-03' });
    const id = created.body.request._id;

    await request(app)
      .patch(`/api/leaves/${id}/decision`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'rejected', adminComment: 'Busy period' });

    const cancel = await request(app)
      .delete(`/api/leaves/${id}`)
      .set('Authorization', `Bearer ${employee.token}`);
    expect(cancel.status).toBe(409);
  });
});
