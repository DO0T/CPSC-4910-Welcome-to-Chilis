const express = require('express');
const request = require('supertest');
const { createDriverCatalogRouter } = require('./driver-catalog');

function setup({ sponsor = 7, item = true, balance = 100, role = 'Driver' } = {}) {
  const connection = {
    beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
    query: jest.fn(async (sql) => {
      if (sql.startsWith('SELECT sponsor_id FROM Drivers')) return [[{ sponsor_id: sponsor }]];
      if (sql.includes('FROM SponsorCatalogItems')) return [item ? [{ title: 'Reward', ebay_price: '10.00', price_override: null, point_value: '0.25' }] : []];
      if (sql.startsWith('SELECT COALESCE')) return [[{ balance }]];
      return [{}];
    }),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.userId = 42; req.userRole = role; next(); });
  app.use('/catalog', createDriverCatalogRouter(pool));
  return { app, pool, connection };
}

const purchase = (app, body = {}) => request(app).post('/catalog/purchase').send({ itemId: 3, sponsorId: 7, pointCost: 40, ...body });

test('deducts the server-calculated cost from the active sponsor and records it', async () => {
  const { app, connection } = setup();
  const response = await purchase(app);
  expect(response.statusCode).toBe(200);
  expect(response.body.balance).toBe(60);
  expect(connection.query.mock.calls.find(([sql]) => sql.startsWith('SELECT COALESCE'))[1]).toEqual([42, 7]);
  expect(connection.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO DriverPoints'))[1]).toEqual([42, 7, -40, 'Simulated purchase: Reward']);
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test.each([
  ['insufficient sponsor balance', { balance: 39 }, {}],
  ['a switched active sponsor', { sponsor: 8 }, {}],
  ['an unavailable or other sponsor item', { item: false }, {}],
  ['a changed or manipulated price', {}, { pointCost: 1 }],
])('rejects %s without recording a purchase', async (_label, options, body) => {
  const { app, connection } = setup(options);
  expect((await purchase(app, body)).statusCode).toBe(409);
  expect(connection.rollback).toHaveBeenCalled();
  expect(connection.commit).not.toHaveBeenCalled();
  expect(connection.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO DriverPoints'))).toBe(false);
});

test('rejects other roles before accessing the database', async () => {
  const { app, pool } = setup({ role: 'Sponsor' });
  expect((await purchase(app)).statusCode).toBe(403);
  expect(pool.getConnection).not.toHaveBeenCalled();
});
