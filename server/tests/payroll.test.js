const { app, request, loginAs } = require('./helpers');

describe('payroll visibility', () => {
  it('gives employees a read-only breakdown and admins write access', async () => {
    const employee = await loginAs();
    const admin = await loginAs({ role: 'admin' });

    // Employee read: zeros until HR sets a structure.
    const initial = await request(app)
      .get('/api/payroll/me')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.salary.net).toBe(0);

    // Employee cannot write payroll - not even their own record.
    const forbidden = await request(app)
      .put(`/api/payroll/${employee.user._id}`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ basic: 99999 });
    expect(forbidden.status).toBe(403);

    // Admin sets the structure.
    const update = await request(app)
      .put(`/api/payroll/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ basic: 50000, hra: 20000, allowances: 5000, deductions: 7500 });
    expect(update.status).toBe(200);
    expect(update.body.salary.gross).toBe(75000);
    expect(update.body.salary.net).toBe(67500);

    // Employee sees the update immediately.
    const after = await request(app)
      .get('/api/payroll/me')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(after.body.salary.net).toBe(67500);
  });

  it('rejects negative amounts', async () => {
    const employee = await loginAs();
    const admin = await loginAs({ role: 'admin' });
    const res = await request(app)
      .put(`/api/payroll/${employee.user._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ basic: -1 });
    expect(res.status).toBe(400);
  });

  it('strips Mongo operator injection from request bodies', async () => {
    const employee = await loginAs();
    const res = await request(app)
      .patch('/api/profiles/me')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ personal: { phone: '123' }, $where: 'sleep(1000)' });
    expect(res.status).toBe(200);
    expect(res.body.profile.personal.phone).toBe('123');
  });
});
