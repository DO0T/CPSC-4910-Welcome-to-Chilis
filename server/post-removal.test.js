const express = require('express');
const request = require('supertest');
const { createPostRemovalRouter } = require('./post-removal');
function appFor(pool, role = 'Sponsor') {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.userRole = role; req.userId = 9; next(); });
  app.use('/api', createPostRemovalRouter(pool)); return app;
}
test('validates the policy and requires a sponsor', async () => {
  const pool = { query: jest.fn() };
  expect((await request(appFor(pool)).put('/api/sponsor/policy').send({ days: -1 })).status).toBe(400);
  expect((await request(appFor(pool, 'Driver')).put('/api/sponsor/policy').send({ days: 2 })).status).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});
test('saves policy and alerts current drivers in the same transaction', async () => {
  const connection = { beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(), query: jest.fn()
    .mockResolvedValueOnce([[{ sponsor_id: 2, company_name: 'Acme', post_removal_days: 0 }]])
    .mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]) };
  const response = await request(appFor({ getConnection: async () => connection })).put('/api/sponsor/policy').send({ days: 30 });
  expect(response.status).toBe(200);
  expect(connection.query.mock.calls[1][1]).toEqual([30, 2]);
  expect(connection.query.mock.calls[2][1][0]).toContain('30 days');
  expect(connection.commit).toHaveBeenCalled();
});
test('returns access status and sponsor-specific point balances', async () => {
  const pool = { query: jest.fn().mockResolvedValue([[{ company_name: 'Acme', permitted: 1, points: '42', expires_at: '2027-01-01', removed_at: '2026-12-01' }]]) };
  const response = await request(appFor(pool, 'Driver')).get('/api/driver/post-removal-access');
  expect(response.body[0]).toMatchObject({ companyName: 'Acme', permitted: true, points: 42 });
  expect(pool.query.mock.calls[0][1]).toEqual([9]);
});
