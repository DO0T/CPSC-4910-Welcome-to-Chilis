const express = require('express');
const request = require('supertest');
const { createDriverSponsorshipsRouter } = require('./driver-sponsorships');

function setup({ role = 'Driver', rows = [] } = {}) {
  const pool = { query: jest.fn().mockResolvedValue([rows]) };
  const app = express();
  app.use((req, res, next) => {
    req.userId = 42;
    req.userRole = role;
    next();
  });
  app.use('/api/driver/sponsorships', createDriverSponsorshipsRouter(pool));
  return { app, pool };
}

test('lists only the logged-in driver memberships and marks the current sponsor', async () => {
  const { app, pool } = setup({ rows: [
    { sponsor_id: 7, company_name: 'Acme', active_sponsor_id: 7 },
    { sponsor_id: 9, company_name: 'Beacon', active_sponsor_id: 7 },
  ] });
  const response = await request(app).get('/api/driver/sponsorships?driverId=999');
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual([
    { sponsorId: 7, companyName: 'Acme', isActive: true },
    { sponsorId: 9, companyName: 'Beacon', isActive: false },
  ]);
  expect(pool.query.mock.calls[0][1]).toEqual([42]);
  expect(pool.query.mock.calls[0][0]).toContain('WHERE ds.driver_id = ?');
});

test('returns an empty list when the driver has no memberships', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/driver/sponsorships');
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual([]);
});

test('rejects non-drivers without querying sponsorships', async () => {
  const { app, pool } = setup({ role: 'Sponsor' });
  const response = await request(app).get('/api/driver/sponsorships');
  expect(response.statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('reports a missing migration clearly', async () => {
  const { app, pool } = setup();
  pool.query.mockRejectedValueOnce(Object.assign(new Error('Missing table'), { code: 'ER_NO_SUCH_TABLE' }));
  const response = await request(app).get('/api/driver/sponsorships');
  expect(response.statusCode).toBe(503);
  expect(response.body.message).toMatch(/not set up/);
});

function setupSwitch({ role = 'Driver', activeSponsorId = 7, membership = [{ company_name: 'Beacon' }] } = {}) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
    query: jest.fn()
      .mockResolvedValueOnce([[{ sponsor_id: activeSponsorId }]])
      .mockResolvedValueOnce([membership])
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
  app.use('/api/driver/sponsorships', createDriverSponsorshipsRouter(pool));
  return { app, pool, connection };
}

test('switches only to a sponsor linked to the logged-in driver', async () => {
  const { app, connection } = setupSwitch();
  const response = await request(app).patch('/api/driver/sponsorships/active')
    .send({ sponsorId: 9, driverId: 999 });
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ activeSponsorId: 9, companyName: 'Beacon' });
  expect(connection.query.mock.calls[0][1]).toEqual([42]);
  expect(connection.query.mock.calls[1][1]).toEqual([42, 9]);
  expect(connection.query.mock.calls[2][1]).toEqual([9, 42]);
  expect(connection.query.mock.calls[2][0]).not.toContain('DriverSponsorships');
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test('does not switch to a sponsor without membership', async () => {
  const { app, connection } = setupSwitch({ membership: [] });
  const response = await request(app).patch('/api/driver/sponsorships/active')
    .send({ sponsorId: 9 });
  expect(response.statusCode).toBe(403);
  expect(connection.query).toHaveBeenCalledTimes(2);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});

test('switching to the current sponsor is safe and makes no update', async () => {
  const { app, connection } = setupSwitch({ activeSponsorId: 9 });
  const response = await request(app).patch('/api/driver/sponsorships/active')
    .send({ sponsorId: 9 });
  expect(response.statusCode).toBe(200);
  expect(connection.query).toHaveBeenCalledTimes(2);
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test('rejects invalid IDs and non-drivers before opening a transaction', async () => {
  const invalid = setupSwitch();
  expect((await request(invalid.app).patch('/api/driver/sponsorships/active')
    .send({ sponsorId: 0 })).statusCode).toBe(400);
  expect(invalid.pool.getConnection).not.toHaveBeenCalled();

  const sponsor = setupSwitch({ role: 'Sponsor' });
  expect((await request(sponsor.app).patch('/api/driver/sponsorships/active')
    .send({ sponsorId: 9 })).statusCode).toBe(403);
  expect(sponsor.pool.getConnection).not.toHaveBeenCalled();
});

test('a failed switch rolls back without changing the active sponsor', async () => {
  const { app, connection } = setupSwitch();
  connection.query.mockReset()
    .mockResolvedValueOnce([[{ sponsor_id: 7 }]])
    .mockResolvedValueOnce([[{ company_name: 'Beacon' }]])
    .mockRejectedValueOnce(new Error('Update failed'));
  const response = await request(app).patch('/api/driver/sponsorships/active')
    .send({ sponsorId: 9 });
  expect(response.statusCode).toBe(500);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
});
