const express = require('express');
const request = require('supertest');
const { createDriverCatalogRouter } = require('./driver-catalog');

function setup({ sponsor = 7, item = true, balance = 100, role = 'Driver', purchaseError = null, purchases = [] } = {}) {
  const connection = {
    beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
    query: jest.fn(async (sql) => {
      if (sql.startsWith('SELECT sponsor_id FROM Drivers')) return [[{ sponsor_id: sponsor }]];
      if (sql.startsWith('SELECT 1 FROM DriverPostRemovalAccess')) return [[]];
      if (sql.includes('FROM SponsorCatalogItems')) return [item ? [{ title: 'Reward', image_url: 'https://example.com/reward.jpg', company_name: 'Acme', ebay_price: '10.00', price_override: null, point_value: '0.25' }] : []];
      if (sql.startsWith('SELECT COALESCE')) return [[{ balance }]];
      if (sql.startsWith('INSERT INTO DriverPoints')) return [{ insertId: 81 }];
      if (sql.includes('INSERT INTO DriverPurchases')) {
        if (purchaseError) throw purchaseError;
        return [{ insertId: 23 }];
      }
      return [{}];
    }),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection), query: jest.fn().mockResolvedValue([purchases]) };
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
  expect(response.body.purchaseId).toBe(23);
  expect(connection.query.mock.calls.find(([sql]) => sql.startsWith('SELECT COALESCE'))[1]).toEqual([42, 7]);
  expect(connection.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO DriverPoints'))[1]).toEqual([42, 7, -40, 'Simulated purchase: Reward']);
  expect(connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO DriverPurchases'))[1]).toEqual([42, 7, 3, 81, 'Acme', 'Reward', 'https://example.com/reward.jpg', 40]);
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test('rolls back the deduction when the purchase record cannot be saved', async () => {
  const { app, connection } = setup({ purchaseError: Object.assign(new Error('missing table'), { code: 'ER_NO_SUCH_TABLE' }) });
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await purchase(app)).statusCode).toBe(503);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});

test('returns only the logged-in driver purchase records', async () => {
  const { app, pool } = setup({ purchases: [{ purchase_id: 23, sponsor_id: 7, sponsor_name: 'Acme', catalog_item_id: 3, item_title: 'Reward', item_image_url: null, points_spent: 40, status: 'COMPLETED', purchased_at: '2026-11-15T12:00:00Z' }] });
  const response = await request(app).get('/catalog/purchases?driverId=999');
  expect(response.statusCode).toBe(200);
  expect(pool.query.mock.calls[0][0]).toContain('WHERE driver_id = ?');
  expect(pool.query.mock.calls[0][1]).toEqual([42]);
  expect(response.body.purchases[0]).toMatchObject({ id: 23, sponsorName: 'Acme', itemTitle: 'Reward', pointsSpent: 40, status: 'COMPLETED' });
});

test('prevents non-drivers from reading purchase records', async () => {
  const { app, pool } = setup({ role: 'Sponsor' });
  expect((await request(app).get('/catalog/purchases')).statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
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

test('does not use another sponsor balance to cover a purchase', async () => {
  const { app, connection } = setup({ balance: 39 });
  const response = await purchase(app);
  expect(response.statusCode).toBe(409);
  const balanceQuery = connection.query.mock.calls.find(([sql]) => sql.startsWith('SELECT COALESCE'));
  expect(balanceQuery[0]).toContain('sponsor_id = ?');
  expect(balanceQuery[1]).toEqual([42, 7]);
  expect(connection.commit).not.toHaveBeenCalled();
});

function cancellationSetup({ row = { purchase_id: 23, sponsor_id: 7, item_title: 'Reward', points_spent: 40, status: 'COMPLETED', within_window: 1 }, role = 'Driver', refundError = false } = {}) {
  const connection = { beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(), query: jest.fn(async (sql) => {
    if (sql.startsWith('SELECT user_id FROM Drivers')) return [[{ user_id: 42 }]];
    if (sql.includes('FROM DriverPurchases')) return [row ? [row] : []];
    if (sql.startsWith('INSERT INTO DriverPoints') && refundError) throw new Error('refund failed');
    return [{}];
  }) };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const app = express();
  app.use((req, res, next) => { req.userId = 42; req.userRole = role; next(); });
  app.use('/catalog', createDriverCatalogRouter(pool));
  return { app, pool, connection };
}

test('cancels a purchase and refunds the original sponsor in one transaction', async () => {
  const { app, connection } = cancellationSetup();
  const response = await request(app).post('/catalog/purchases/23/cancel');
  expect(response.statusCode).toBe(200);
  expect(response.body.status).toBe('CANCELLED');
  expect(connection.query.mock.calls[1][1]).toEqual([23, 42]);
  expect(connection.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO DriverPoints'))[1]).toEqual([42, 7, 40, 'Refund for simulated purchase #23: Reward']);
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test.each([
  ['another driver or nonexistent purchase', null, 404],
  ['already cancelled', { status: 'CANCELLED', within_window: 1 }, 409],
  ['expired cancellation window', { status: 'COMPLETED', within_window: 0 }, 409],
])('rejects %s without issuing a refund', async (_name, row, status) => {
  const { app, connection } = cancellationSetup({ row });
  expect((await request(app).post('/catalog/purchases/23/cancel')).statusCode).toBe(status);
  expect(connection.rollback).toHaveBeenCalled();
  expect(connection.commit).not.toHaveBeenCalled();
  expect(connection.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO DriverPoints'))).toBe(false);
});

test('rolls back the cancellation if the refund fails', async () => {
  const { app, connection } = cancellationSetup({ refundError: true });
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await request(app).post('/catalog/purchases/23/cancel')).statusCode).toBe(500);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});

test('does not allow sponsors to cancel a driver purchase', async () => {
  const { app, pool } = cancellationSetup({ role: 'Sponsor' });
  expect((await request(app).post('/catalog/purchases/23/cancel')).statusCode).toBe(403);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

function cartSetup({ balance = 100, unavailableId = null, failSecondRecord = false, activeSponsor = 7 } = {}) {
  let records = 0;
  const connection = { beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(), query: jest.fn(async (sql, params) => {
    if (sql.startsWith('SELECT sponsor_id FROM Drivers')) return [[{ sponsor_id: activeSponsor }]];
    if (sql.startsWith('SELECT 1 FROM DriverPostRemovalAccess')) return [[]];
    if (sql.includes('FROM SponsorCatalogItems')) {
      if (params[2] === unavailableId) return [[]];
      return [[{ title: `Reward ${params[2]}`, company_name: 'Acme', image_url: null, ebay_price: params[2] === 3 ? '10.00' : '5.00', price_override: null, point_value: '0.25' }]];
    }
    if (sql.startsWith('SELECT COALESCE')) return [[{ balance }]];
    if (sql.startsWith('INSERT INTO DriverPoints')) return [{ insertId: 80 + records }];
    if (sql.includes('INSERT INTO DriverPurchases')) {
      records += 1;
      if (failSecondRecord && records === 2) throw new Error('record failed');
      return [{ insertId: 22 + records }];
    }
    return [{}];
  }) };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.userId = 42; req.userRole = 'Driver'; next(); });
  app.use('/catalog', createDriverCatalogRouter({ getConnection: async () => connection }));
  return { app, connection };
}

const cartItems = [{ itemId: 3, pointCost: 40 }, { itemId: 4, pointCost: 20 }];
test('purchases a cart atomically and records each sponsor-specific deduction', async () => {
  const { app, connection } = cartSetup();
  const response = await request(app).post('/catalog/checkout').send({ sponsorId: 7, items: cartItems });
  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({ balance: 40, purchaseIds: [23, 24] });
  expect(connection.query.mock.calls.find(([sql]) => sql.startsWith('UPDATE Drivers'))[1]).toEqual([60, 42]);
  const ledger = connection.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO DriverPoints'));
  expect(ledger.map(([, params]) => params.slice(0, 3))).toEqual([[42, 7, -40], [42, 7, -20]]);
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test.each([
  ['combined balance is insufficient', { balance: 59 }, cartItems],
  ['an item is unavailable', { unavailableId: 4 }, cartItems],
  ['an item price changed', {}, [cartItems[0], { itemId: 4, pointCost: 19 }]],
  ['the active sponsor changed', { activeSponsor: 8 }, cartItems],
])('rejects cart when %s without purchases', async (_name, options, items) => {
  const { app, connection } = cartSetup(options);
  expect((await request(app).post('/catalog/checkout').send({ sponsorId: 7, items })).statusCode).toBe(409);
  expect(connection.rollback).toHaveBeenCalled();
  expect(connection.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO DriverPoints'))).toBe(false);
});

test('rejects duplicate cart items and rolls back if a record fails', async () => {
  const invalid = cartSetup();
  expect((await request(invalid.app).post('/catalog/checkout').send({ sponsorId: 7, items: [cartItems[0], cartItems[0]] })).statusCode).toBe(400);
  const failed = cartSetup({ failSecondRecord: true });
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await request(failed.app).post('/catalog/checkout').send({ sponsorId: 7, items: cartItems })).statusCode).toBe(500);
    expect(failed.connection.rollback).toHaveBeenCalled();
    expect(failed.connection.commit).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
