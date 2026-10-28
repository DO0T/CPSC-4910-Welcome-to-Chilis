const express = require('express');
const request = require('supertest');
const { createSponsorApplicationsRouter } = require('./sponsor-applications');

function setup({ role = 'Sponsor', sponsorRows = [{ sponsor_id: 7 }], applications = [] } = {}) {
  const pool = { query: jest.fn()
    .mockResolvedValueOnce([sponsorRows])
    .mockResolvedValueOnce([applications]) };
  const app = express();
  app.use((req, res, next) => {
    req.userId = 42;
    req.userRole = role;
    next();
  });
  app.use('/api/sponsor/applications', createSponsorApplicationsRouter(pool));
  return { app, pool };
}

test('lists pending applications for the logged-in sponsor only', async () => {
  const { app, pool } = setup({ applications: [
    { application_id: 11, driver_id: 23, driver_name: 'Alex Driver', applied_at: '2026-10-23T12:00:00.000Z' },
  ] });
  const response = await request(app).get('/api/sponsor/applications?sponsorId=999');
  expect(response.statusCode).toBe(200);
  expect(response.body.applications).toEqual([{
    applicationId: 11,
    driverId: 23,
    driverName: 'Alex Driver',
    appliedAt: '2026-10-23T12:00:00.000Z',
    status: 'PENDING',
  }]);
  expect(pool.query.mock.calls[0][1]).toEqual([42]);
  expect(pool.query.mock.calls[1][1]).toEqual([7]);
  expect(pool.query.mock.calls[1][0]).toContain("a.status = 'PENDING'");
});

test('rejects a non-sponsor without querying the database', async () => {
  const { app, pool } = setup({ role: 'Driver' });
  const response = await request(app).get('/api/sponsor/applications');
  expect(response.statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('rejects a sponsor account without a linked organization', async () => {
  const { app, pool } = setup({ sponsorRows: [] });
  const response = await request(app).get('/api/sponsor/applications');
  expect(response.statusCode).toBe(403);
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test('returns an empty list when there are no pending applications', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/sponsor/applications');
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ applications: [] });
});

test('loads a pending driver profile only for the logged-in sponsor', async () => {
  const { app, pool } = setup({ applications: [{
    application_id: 11, driver_id: 23, driver_name: 'Alex Driver',
    driver_email: 'alex@example.com', profile_picture_url: null,
    applied_at: '2026-10-23T12:00:00.000Z',
  }] });
  const response = await request(app).get('/api/sponsor/applications/11?sponsorId=999');
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({
    applicationId: 11, driverId: 23, driverName: 'Alex Driver',
    email: 'alex@example.com', profilePictureUrl: null,
    appliedAt: '2026-10-23T12:00:00.000Z',
  });
  expect(pool.query.mock.calls[0][1]).toEqual([42]);
  expect(pool.query.mock.calls[1][1]).toEqual([11, 7]);
  expect(pool.query.mock.calls[1][0]).toContain("a.status = 'PENDING'");
});

test('does not reveal driver information from another sponsor', async () => {
  const { app, pool } = setup({ applications: [] });
  const response = await request(app).get('/api/sponsor/applications/11');
  expect(response.statusCode).toBe(404);
  expect(pool.query.mock.calls[1][1]).toEqual([11, 7]);
});

test('drivers cannot open sponsor application details', async () => {
  const { app, pool } = setup({ role: 'Driver' });
  const response = await request(app).get('/api/sponsor/applications/11');
  expect(response.statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

function setupDecision({ role = 'Sponsor', sponsorRows = [{ sponsor_id: 7 }], applicationRows = [{ application_id: 11, driver_id: 23, status: 'PENDING' }] } = {}) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn()
      .mockResolvedValueOnce([sponsorRows])
      .mockResolvedValueOnce([applicationRows])
      .mockResolvedValueOnce([{ affectedRows: 1 }]),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.userId = 42;
    req.userRole = role;
    next();
  });
  app.use('/api/sponsor/applications', createSponsorApplicationsRouter(pool));
  return { app, pool, connection };
}

test.each(['APPROVED', 'DENIED'])('records a %s decision for this sponsor', async (decision) => {
  const { app, connection } = setupDecision();
  const response = await request(app).patch('/api/sponsor/applications/11')
    .send({ decision, sponsorId: 999 });
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ applicationId: 11, driverId: 23, status: decision });
  expect(connection.query.mock.calls[0][1]).toEqual([42]);
  expect(connection.query.mock.calls[1][1]).toEqual([11, 7]);
  expect(connection.query.mock.calls[2][1]).toEqual([decision, 42, 11, 7]);
  expect(connection.query.mock.calls[2][0]).not.toContain('Drivers SET');
  if (decision === 'APPROVED') {
    expect(connection.query.mock.calls[3][0]).toContain('INSERT INTO DriverSponsorships');
    expect(connection.query.mock.calls[3][1]).toEqual([23, 7]);
  } else {
    expect(connection.query).toHaveBeenCalledTimes(3);
  }
  expect(connection.commit).toHaveBeenCalledTimes(1);
  expect(connection.release).toHaveBeenCalledTimes(1);
});

test('rejects drivers and invalid decisions before opening a transaction', async () => {
  const driver = setupDecision({ role: 'Driver' });
  expect((await request(driver.app).patch('/api/sponsor/applications/11').send({ decision: 'APPROVED' })).statusCode).toBe(403);
  expect(driver.pool.getConnection).not.toHaveBeenCalled();

  const invalid = setupDecision();
  expect((await request(invalid.app).patch('/api/sponsor/applications/0').send({ decision: 'APPROVED' })).statusCode).toBe(400);
  expect((await request(invalid.app).patch('/api/sponsor/applications/11').send({ decision: 'PENDING' })).statusCode).toBe(400);
  expect(invalid.pool.getConnection).not.toHaveBeenCalled();
});

test('cannot decide an application belonging to another sponsor', async () => {
  const { app, connection } = setupDecision({ applicationRows: [] });
  const response = await request(app).patch('/api/sponsor/applications/11').send({ decision: 'APPROVED' });
  expect(response.statusCode).toBe(404);
  expect(connection.query).toHaveBeenCalledTimes(2);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});

test('cannot change an application after it has been decided', async () => {
  const { app, connection } = setupDecision({ applicationRows: [{ application_id: 11, driver_id: 23, status: 'APPROVED' }] });
  const response = await request(app).patch('/api/sponsor/applications/11').send({ decision: 'DENIED' });
  expect(response.statusCode).toBe(409);
  expect(connection.query).toHaveBeenCalledTimes(2);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});

function setupBulk({ role = 'Sponsor', sponsorRows = [{ sponsor_id: 7 }], rows = [
  { application_id: 11, driver_id: 23, status: 'PENDING' },
  { application_id: 12, driver_id: 24, status: 'PENDING' },
], affectedRows = 2 } = {}) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn()
      .mockResolvedValueOnce([sponsorRows])
      .mockResolvedValueOnce([rows])
      .mockResolvedValueOnce([{ affectedRows }]),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.userId = 42;
    req.userRole = role;
    next();
  });
  app.use('/api/sponsor/applications', createSponsorApplicationsRouter(pool));
  return { app, pool, connection };
}

test.each(['APPROVED', 'DENIED'])('bulk %s changes every selected application in one transaction', async (decision) => {
  const { app, connection } = setupBulk();
  const response = await request(app).post('/api/sponsor/applications/bulk/decision')
    .send({ applicationIds: [12, 11], decision, sponsorId: 999 });
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ applicationIds: [11, 12], status: decision, count: 2 });
  expect(connection.query.mock.calls[0][1]).toEqual([42]);
  expect(connection.query.mock.calls[1][1]).toEqual([7, 11, 12]);
  expect(connection.query.mock.calls[2][1]).toEqual([decision, 42, 7, 11, 12]);
  expect(connection.query.mock.calls[2][0]).not.toContain('Drivers SET');
  if (decision === 'APPROVED') {
    expect(connection.query.mock.calls[3][0]).toContain('INSERT INTO DriverSponsorships');
    expect(connection.query.mock.calls[3][1]).toEqual([23, 7, 24, 7]);
  } else {
    expect(connection.query).toHaveBeenCalledTimes(3);
  }
  expect(connection.commit).toHaveBeenCalledTimes(1);
  expect(connection.rollback).not.toHaveBeenCalled();
});

test('bulk decisions reject duplicate, invalid, or excessive selections', async () => {
  const { app, pool } = setupBulk();
  for (const applicationIds of [[], [11, 11], [0], Array.from({ length: 101 }, (_, index) => index + 1)]) {
    const response = await request(app).post('/api/sponsor/applications/bulk/decision')
      .send({ applicationIds, decision: 'APPROVED' });
    expect(response.statusCode).toBe(400);
  }
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('drivers cannot make bulk sponsor decisions', async () => {
  const { app, pool } = setupBulk({ role: 'Driver' });
  const response = await request(app).post('/api/sponsor/applications/bulk/decision')
    .send({ applicationIds: [11, 12], decision: 'APPROVED' });
  expect(response.statusCode).toBe(403);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('bulk decisions roll back when a selection includes another sponsor or a decided request', async () => {
  for (const { rows, expectedStatus } of [
    { rows: [{ application_id: 11, status: 'PENDING' }], expectedStatus: 404 },
    { rows: [{ application_id: 11, status: 'PENDING' }, { application_id: 12, status: 'DENIED' }], expectedStatus: 409 },
  ]) {
    const { app, connection } = setupBulk({ rows });
    const response = await request(app).post('/api/sponsor/applications/bulk/decision')
      .send({ applicationIds: [11, 12], decision: 'APPROVED' });
    expect(response.statusCode).toBe(expectedStatus);
    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  }
});

test('bulk decisions roll back if the update did not affect every row', async () => {
  const { app, connection } = setupBulk({ affectedRows: 1 });
  const response = await request(app).post('/api/sponsor/applications/bulk/decision')
    .send({ applicationIds: [11, 12], decision: 'APPROVED' });
  expect(response.statusCode).toBe(409);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});

test('a failed sponsorship insert rolls back the application approval', async () => {
  const { app, connection } = setupDecision();
  connection.query.mockRejectedValueOnce(new Error('Membership insert failed'));
  const response = await request(app).patch('/api/sponsor/applications/11')
    .send({ decision: 'APPROVED' });
  expect(response.statusCode).toBe(500);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});

test('a failed bulk sponsorship insert rolls back all approvals', async () => {
  const { app, connection } = setupBulk();
  connection.query.mockRejectedValueOnce(new Error('Membership insert failed'));
  const response = await request(app).post('/api/sponsor/applications/bulk/decision')
    .send({ applicationIds: [11, 12], decision: 'APPROVED' });
  expect(response.statusCode).toBe(500);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});
