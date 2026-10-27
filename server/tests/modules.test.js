const { app, request, loginAs } = require('./helpers');

describe('announcements', () => {
  let admin;
  let employee;

  beforeAll(async () => {
    admin = await loginAs({ role: 'admin' });
    employee = await loginAs();
  });

  it('runs the admin create -> employee read -> delete flow', async () => {
    const created = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Town hall', body: 'All hands on Friday at 4pm.' });
    expect(created.status).toBe(201);
    const id = created.body.announcement._id;

    const list = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(list.status).toBe(200);
    expect(list.body.announcements).toHaveLength(1);
    expect(list.body.announcements[0].title).toBe('Town hall');

    const forbidden = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ title: 'Nope', body: 'Nope' });
    expect(forbidden.status).toBe(403);

    const hidden = await request(app)
      .patch(`/api/announcements/${id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(hidden.status).toBe(200);

    const afterHide = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(afterHide.body.announcements).toHaveLength(0);

    const adminList = await request(app)
      .get('/api/announcements/admin')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(adminList.body.announcements).toHaveLength(1);

    const removed = await request(app)
      .delete(`/api/announcements/${id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(removed.status).toBe(200);
  });

  it('validates required fields', async () => {
    const admin = await loginAs({ role: 'admin' });
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('training', () => {
  let admin;
  let employee;

  beforeAll(async () => {
    admin = await loginAs({ role: 'admin' });
    employee = await loginAs();
  });

  it('runs the admin create/update -> employee read flow', async () => {
    const created = await request(app)
      .post('/api/trainings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Security awareness',
        description: 'Annual mandatory training',
        category: 'Compliance',
        startDate: '2032-09-01',
        endDate: '2032-09-30',
        mandatory: true,
      });
    expect(created.status).toBe(201);

    const list = await request(app)
      .get('/api/trainings')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(list.status).toBe(200);
    expect(list.body.trainings).toHaveLength(1);
    expect(list.body.trainings[0].mandatory).toBe(true);

    const forbidden = await request(app)
      .delete(`/api/trainings/${created.body.training._id}`)
      .set('Authorization', `Bearer ${employee.token}`);
    expect(forbidden.status).toBe(403);

    const updated = await request(app)
      .patch(`/api/trainings/${created.body.training._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(updated.status).toBe(200);

    const after = await request(app)
      .get('/api/trainings')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(after.body.trainings).toHaveLength(0);
  });

  it('rejects an inverted date range', async () => {
    const admin = await loginAs({ role: 'admin' });
    const res = await request(app)
      .post('/api/trainings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ title: 'Bad dates', startDate: '2032-10-10', endDate: '2032-10-01' });
    expect(res.status).toBe(400);
  });
});
