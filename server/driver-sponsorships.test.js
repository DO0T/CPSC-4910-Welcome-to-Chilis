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
