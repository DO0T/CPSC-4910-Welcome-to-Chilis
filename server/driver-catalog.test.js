const express = require('express');
const request = require('supertest');
const { createDriverCatalogRouter } = require('./driver-catalog');

function setup({ role = 'Driver', drivers = [{
  sponsor_id: 7, company_name: 'Acme', point_value: '0.25', membership_driver_id: 42,
}], items = [] } = {}) {
  const pool = { query: jest.fn()
    .mockResolvedValueOnce([drivers])
    .mockResolvedValueOnce([items]) };
  const app = express();
  app.use((req, res, next) => {
    req.userId = 42;
    req.userRole = role;
    next();
  });
  app.use('/api/driver/catalog', createDriverCatalogRouter(pool));
  return { app, pool };
}

test('loads only approved, available items from the active sponsor and calculates points', async () => {
  const { app, pool } = setup({ items: [
    { id: 3, title: 'Reward A', image_url: 'https://example.com/a.jpg', item_url: 'https://example.com/item', media_rating: 'PG', ebay_price: '10.01', price_override: null, currency: 'USD' },
    { id: 4, title: 'Reward B', image_url: null, ebay_price: '10.00', price_override: '5.00', currency: 'USD' },
  ] });
  const response = await request(app).get('/api/driver/catalog');
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({
    sponsorId: 7,
    companyName: 'Acme',
    pointValue: 0.25,
    balance: 0,
    items: [
      { id: 3, title: 'Reward A', imageUrl: 'https://example.com/a.jpg', itemUrl: 'https://example.com/item', mediaRating: 'PG', pointCost: 41 },
      { id: 4, title: 'Reward B', imageUrl: '', itemUrl: '', mediaRating: null, pointCost: 20 },
    ],
  });
  expect(pool.query.mock.calls[0][1]).toEqual([42]);
  expect(pool.query.mock.calls[1][1]).toEqual([7]);
  expect(pool.query.mock.calls[1][0]).toContain('active = 1');
  expect(pool.query.mock.calls[1][0]).toContain('is_available = 1');
  expect(pool.query.mock.calls[1][0]).toContain('family_friendly_confirmed = 1');
});

test('shows an empty catalog without contacting eBay', async () => {
  const { app, pool } = setup();
  const response = await request(app).get('/api/driver/catalog');
  expect(response.statusCode).toBe(200);
  expect(response.body.items).toEqual([]);
  expect(response.body.pointValue).toBe(0.25);
  expect(pool.query).toHaveBeenCalledTimes(2);
});

test('requires an active sponsor that belongs to this driver', async () => {
  for (const driver of [
    { sponsor_id: null, company_name: null, point_value: null, membership_driver_id: null },
    { sponsor_id: 7, company_name: 'Acme', point_value: '0.25', membership_driver_id: null },
  ]) {
    const { app, pool } = setup({ drivers: [driver] });
    const response = await request(app).get('/api/driver/catalog');
    expect(response.statusCode).toBe(409);
    expect(pool.query).toHaveBeenCalledTimes(1);
  }
});

test('does not allow other roles to read a driver catalog', async () => {
  const { app, pool } = setup({ role: 'Sponsor' });
  const response = await request(app).get('/api/driver/catalog');
  expect(response.statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('reports a missing driver account or migration', async () => {
  const absent = setup({ drivers: [] });
  expect((await request(absent.app).get('/api/driver/catalog')).statusCode).toBe(404);

  const missingTable = setup();
  missingTable.pool.query.mockReset().mockRejectedValueOnce(
    Object.assign(new Error('Missing table'), { code: 'ER_NO_SUCH_TABLE' })
  );
  expect((await request(missingTable.app).get('/api/driver/catalog')).statusCode).toBe(503);
});


test('former sponsor catalog requires unexpired access for the signed-in driver', async () => {
  const { app, pool } = setup({ drivers: [] });
  const response = await request(app).get('/api/driver/catalog?sponsorId=7');
  expect(response.statusCode).toBe(403);
  expect(pool.query.mock.calls[0][0]).toContain('a.expires_at > NOW()');
  expect(pool.query.mock.calls[0][1]).toEqual([42, 42, 7]);
});

test('former sponsor catalog loads rewards when access is permitted', async () => {
  const { app, pool } = setup({ drivers: [{ sponsor_id: 7, company_name: 'Acme', point_value: '0.25', balance: 20 }] });
  const response = await request(app).get('/api/driver/catalog?sponsorId=7');
  expect(response.statusCode).toBe(200);
  expect(response.body.balance).toBe(20);
  expect(pool.query.mock.calls[1][1]).toEqual([7]);
});


test('purchase denies a former sponsor after access expires', async () => {
  const connection = { beginTransaction: jest.fn(), rollback: jest.fn(), release: jest.fn(), query: jest.fn().mockResolvedValueOnce([[{ sponsor_id: null }]]).mockResolvedValueOnce([[]]) };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.userId = 42; req.userRole = 'Driver'; next(); });
  app.use('/catalog', createDriverCatalogRouter({ getConnection: async () => connection }));
  const response = await request(app).post('/catalog/purchase').send({ itemId: 3, sponsorId: 7, pointCost: 10 });
  expect(response.status).toBe(409);
  expect(connection.rollback).toHaveBeenCalled();
  expect(connection.query.mock.calls[1][0]).toContain('a.expires_at > NOW()');
});
