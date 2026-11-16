const express = require('express');
const request = require('supertest');
const { createAlertRouter } = require('./alerts');

function setup() {
  const pool = { query: jest.fn() };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.userId = 42; next(); });
  app.use('/alerts', createAlertRouter(pool));
  return { app, pool };
}

test('returns viewed state for only the current user', async () => {
  const { app, pool } = setup();
  pool.query.mockResolvedValueOnce([[{ id: 1, is_viewed: 0 }, { id: 2, is_viewed: 1 }]]);
  const response = await request(app).get('/alerts');
  expect(response.body).toEqual([{ id: 1, is_viewed: 0 }, { id: 2, is_viewed: 1 }]);
  expect(pool.query.mock.calls[0][0]).toContain('is_viewed');
  expect(pool.query.mock.calls[0][1]).toEqual([42]);
});

test('marks only specified alerts belonging to the current user', async () => {
  const { app, pool } = setup();
  pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
  expect((await request(app).post('/alerts/viewed').send({ ids: [1, 2], userId: 999 })).statusCode).toBe(200);
  expect(pool.query.mock.calls[0][0]).toContain('WHERE user_id = ? AND alert_id IN (?)');
  expect(pool.query.mock.calls[0][1]).toEqual([42, [1, 2]]);
});

test('rejects invalid alert IDs without updating the database', async () => {
  const { app, pool } = setup();
  for (const ids of [[], [0], ['1'], null]) {
    expect((await request(app).post('/alerts/viewed').send({ ids })).statusCode).toBe(400);
  }
  expect(pool.query).not.toHaveBeenCalled();
});
