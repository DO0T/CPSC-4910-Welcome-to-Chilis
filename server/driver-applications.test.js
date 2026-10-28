const express = require('express');
const request = require('supertest');
const { createDriverApplicationsRouter } = require('./driver-applications');

function setup({ role = 'Driver', sponsorId = null, latest = null, sponsorExists = true } = {}) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn(async (sql) => {
      if (sql.includes('FROM Drivers')) return [[{ sponsor_id: sponsorId }]];
      if (sql.includes('FROM Sponsors')) return [sponsorExists ? [{ sponsor_id: 7 }] : []];
      if (sql.includes('FROM DriverSponsorships')) return [[]];
      if (sql.includes('FROM DriverApplications')) return [latest ? [latest] : []];
      if (sql.includes('INSERT INTO DriverApplications')) return [{ insertId: 13 }];
      throw new Error(`Unexpected query: ${sql}`);
    }),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.userId = 42;
    req.userRole = role;
    next();
  });

  const createAuditLog = jest.fn().mockResolvedValue();
  app.use('/api/driver/applications', createDriverApplicationsRouter(pool, createAuditLog));
  return { app, pool, connection, createAuditLog };
}

test('submits a pending application using the session driver ID', async () => {
  const { app, connection } = setup();
  const response = await request(app).post('/api/driver/applications')
    .send({ sponsorId: 7, driverId: 999 });
  expect(response.statusCode).toBe(201);
  expect(response.body).toMatchObject({ applicationId: 13, sponsorId: 7, status: 'PENDING' });
  expect(connection.query).toHaveBeenCalledWith(
    'INSERT INTO DriverApplications (driver_id, sponsor_id) VALUES (?, ?)',
    [42, 7]
  );
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test('rejects non-drivers before using the database', async () => {
  const { app, pool } = setup({ role: 'Sponsor' });
  const response = await request(app).post('/api/driver/applications').send({ sponsorId: 7 });
  expect(response.statusCode).toBe(403);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('rejects an invalid or unknown sponsor', async () => {
  const invalid = setup();
  expect((await request(invalid.app).post('/api/driver/applications').send({ sponsorId: 0 })).statusCode).toBe(400);
  expect(invalid.pool.getConnection).not.toHaveBeenCalled();

  const missing = setup({ sponsorExists: false });
  expect((await request(missing.app).post('/api/driver/applications').send({ sponsorId: 7 })).statusCode).toBe(404);
  expect(missing.connection.rollback).toHaveBeenCalledTimes(1);
});

test('does not apply to an existing sponsor or with an application pending', async () => {
  const member = setup({ sponsorId: 7 });
  expect((await request(member.app).post('/api/driver/applications').send({ sponsorId: 7 })).statusCode).toBe(409);

  const pending = setup({ latest: { status: 'PENDING' } });
  expect((await request(pending.app).post('/api/driver/applications').send({ sponsorId: 7 })).statusCode).toBe(409);
  expect(pending.connection.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO DriverApplications'))).toBe(false);
});

test('requires 30 days after a denial, then allows a new attempt', async () => {
  const recent = setup({ latest: { status: 'DENIED', decided_at: new Date(), cooldown_complete: 0 } });
  expect((await request(recent.app).post('/api/driver/applications').send({ sponsorId: 7 })).statusCode).toBe(409);

  const elapsed = setup({ latest: { status: 'DENIED', decided_at: new Date(), cooldown_complete: 1 } });
  expect((await request(elapsed.app).post('/api/driver/applications').send({ sponsorId: 7 })).statusCode).toBe(201);
});

test('does not submit another application after approval', async () => {
  const { app } = setup({ latest: { status: 'APPROVED' } });
  expect((await request(app).post('/api/driver/applications').send({ sponsorId: 7 })).statusCode).toBe(409);
});

test('lists sponsors with availability based on the logged-in driver', async () => {
  const { app, pool } = setup();
  pool.query = jest.fn()
    .mockResolvedValueOnce([[{ sponsor_id: 7 }]])
    .mockResolvedValueOnce([[
      { sponsor_id: 7, company_name: 'Current', member_driver_id: 42, status: null, cooldown_complete: null },
      { sponsor_id: 8, company_name: 'Waiting', status: 'PENDING', cooldown_complete: null },
      { sponsor_id: 9, company_name: 'Later', status: 'DENIED', cooldown_complete: 0 },
      { sponsor_id: 10, company_name: 'Ready', status: 'DENIED', cooldown_complete: 1 },
    ]]);
  const response = await request(app).get('/api/driver/applications/sponsors');
  expect(response.statusCode).toBe(200);
  expect(response.body.map(({ availability, canApply }) => ({ availability, canApply }))).toEqual([
    { availability: 'sponsored', canApply: false },
    { availability: 'pending', canApply: false },
    { availability: 'cooldown', canApply: false },
    { availability: 'available', canApply: true },
  ]);
  expect(pool.query.mock.calls[0][1]).toEqual([42]);
  expect(pool.query.mock.calls[1][1]).toEqual([42, 42]);
});

test('returns the latest application status and decision dates for the driver', async () => {
  const { app, pool } = setup();
  pool.query = jest.fn()
    .mockResolvedValueOnce([[{ sponsor_id: null }]])
    .mockResolvedValueOnce([[
      {
        sponsor_id: 7, company_name: 'Pending Sponsor', status: 'PENDING',
        applied_at: '2026-10-20T12:00:00.000Z', decided_at: null,
        can_reapply_at: null, cooldown_complete: null,
      },
      {
        sponsor_id: 8, company_name: 'Denied Sponsor', status: 'DENIED',
        applied_at: '2026-09-20T12:00:00.000Z', decided_at: '2026-09-22T12:00:00.000Z',
        can_reapply_at: '2026-10-22T12:00:00.000Z', cooldown_complete: 1,
      },
    ]]);

  const response = await request(app).get('/api/driver/applications/sponsors');
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual([
    expect.objectContaining({
      sponsorId: 7, applicationStatus: 'PENDING', availability: 'pending',
      appliedAt: '2026-10-20T12:00:00.000Z', decidedAt: null, canReapplyAt: null,
    }),
    expect.objectContaining({
      sponsorId: 8, applicationStatus: 'DENIED', availability: 'available', canApply: true,
      appliedAt: '2026-09-20T12:00:00.000Z', decidedAt: '2026-09-22T12:00:00.000Z',
      canReapplyAt: '2026-10-22T12:00:00.000Z',
    }),
  ]);
  expect(pool.query.mock.calls[1][0]).toContain('can_reapply_at');
  expect(pool.query.mock.calls[1][1]).toEqual([42, 42]);
});

test('keeps a previous sponsor marked as a membership after switching', async () => {
  const { app, pool } = setup({ sponsorId: 8 });
  pool.query = jest.fn()
    .mockResolvedValueOnce([[{ sponsor_id: 8 }]])
    .mockResolvedValueOnce([[
      { sponsor_id: 7, company_name: 'Previous', member_driver_id: 42, status: null },
      { sponsor_id: 8, company_name: 'Current', member_driver_id: 42, status: null },
    ]]);
  const response = await request(app).get('/api/driver/applications/sponsors');
  expect(response.statusCode).toBe(200);
  expect(response.body.map(({ availability, canApply }) => ({ availability, canApply }))).toEqual([
    { availability: 'approved', canApply: false },
    { availability: 'sponsored', canApply: false },
  ]);
});

test('does not reapply to a sponsor the driver already belongs to', async () => {
  const { app, connection } = setup();
  const originalQuery = connection.query;
  connection.query = jest.fn((sql, params) => sql.includes('FROM DriverSponsorships')
    ? Promise.resolve([[{ 1: 1 }]]) : originalQuery(sql, params));
  const response = await request(app).post('/api/driver/applications').send({ sponsorId: 7 });
  expect(response.statusCode).toBe(409);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO DriverApplications'))).toBe(false);
});

test('creates an audit log when a driver submits an application', async () => {
  const { app, connection, createAuditLog } = setup();

  const response = await request(app)
    .post('/api/driver/applications')
    .send({ sponsorId: 7 });

  expect(response.statusCode).toBe(201);

  expect(createAuditLog).toHaveBeenCalledWith(
    null,
    'Driver Application',
    'PENDING',
    expect.stringContaining(
      'Application ID: 13; Driver ID: 42; Sponsor ID: 7'
    ),
    connection
  );

  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test('rolls back application when audit logging fails', async () => {
  const { app, connection, createAuditLog } = setup();

  createAuditLog.mockRejectedValueOnce(
    new Error('Audit logging failed')
  );

  const response = await request(app)
    .post('/api/driver/applications')
    .send({ sponsorId: 7 });

  expect(response.statusCode).toBe(500);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});
