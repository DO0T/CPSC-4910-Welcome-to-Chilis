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
