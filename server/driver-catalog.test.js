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
    { id: 3, title: 'Reward A', image_url: 'https://example.com/a.jpg', ebay_price: '10.01', price_override: null, currency: 'USD' },
    { id: 4, title: 'Reward B', image_url: null, ebay_price: '10.00', price_override: '5.00', currency: 'USD' },
  ] });
  const response = await request(app).get('/api/driver/catalog?sponsorId=999');
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({
    sponsorId: 7,
    companyName: 'Acme',
    items: [
      { id: 3, title: 'Reward A', imageUrl: 'https://example.com/a.jpg', pointCost: 41 },
      { id: 4, title: 'Reward B', imageUrl: '', pointCost: 20 },
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
