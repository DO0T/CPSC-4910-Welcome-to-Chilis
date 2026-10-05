const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn() }));

const pool = { query: jest.fn(), getConnection: jest.fn() };
mysql.createPool.mockReturnValue(pool);
const app = require('./server');

beforeEach(() => {
  pool.query.mockReset();
  bcrypt.compare.mockResolvedValue(true);
});

async function loginAs(role) {
  pool.query
    .mockResolvedValueOnce([[{ user_id: 12, role, password_hash: 'hash' }]])
    .mockResolvedValueOnce([{}]);

  const response = await request(app).post('/api/login').send({
    username: 'person@example.com', password: 'password',
  });
  expect(response.statusCode).toBe(200);
  pool.query.mockReset();
  return response.body.token;
}

test('requires login for sponsor dashboard data', async () => {
  const response = await request(app).get('/api/sponsor/dashboard');
  expect(response.statusCode).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('returns only the logged-in sponsor organization data', async () => {
  const token = await loginAs('Sponsor');
  pool.query
    .mockResolvedValueOnce([[{ role: 'Sponsor', sponsor_id: 7, company_name: 'North Star Transport' }]])
    .mockResolvedValueOnce([[{ sponsored_drivers: 3 }]])
    .mockResolvedValueOnce([[{ points_awarded_this_month: '125' }]])
    .mockResolvedValueOnce([[
      { id: 9, driver_id: 20, driver_name: 'Taylor Lee', reason: 'Safe driving', point_change: 50, transaction_date: '2026-10-04T12:00:00.000Z' },
    ]]);

  const response = await request(app).get('/api/sponsor/dashboard')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    companyName: 'North Star Transport',
    sponsoredDrivers: 3,
    pointsAwardedThisMonth: 125,
    recentActivity: [{ id: 9, driver: 'Taylor Lee', points: 50 }],
  });
  expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('WHERE u.user_id = ?'), [12]);
  for (let call = 2; call <= 4; call += 1) {
    expect(pool.query.mock.calls[call - 1][1]).toEqual([7]);
  }
});

test('rejects a logged-in driver before reading sponsor data', async () => {
  const token = await loginAs('Driver');
  pool.query.mockResolvedValueOnce([[{ role: 'Driver', sponsor_id: null, company_name: null }]]);

  const response = await request(app).get('/api/sponsor/dashboard')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(403);
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test('keeps available sponsor data when point queries fail', async () => {
  const token = await loginAs('Sponsor');
  pool.query
    .mockResolvedValueOnce([[{ role: 'Sponsor', sponsor_id: 7, company_name: 'North Star Transport' }]])
    .mockResolvedValueOnce([[{ sponsored_drivers: 3 }]])
    .mockRejectedValueOnce(new Error('Point table unavailable'))
    .mockRejectedValueOnce(new Error('Point table unavailable'));
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

  try {
    const response = await request(app).get('/api/sponsor/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      companyName: 'North Star Transport', sponsoredDrivers: 3,
      pointsAwardedThisMonth: null, recentActivity: null,
      unavailable: ['points', 'activity'],
    });
  } finally {
    errorLog.mockRestore();
  }
});

test('explains when required sponsor account tables are missing', async () => {
  const token = await loginAs('Sponsor');
  const databaseError = Object.assign(new Error('Missing table'), { code: 'ER_NO_SUCH_TABLE' });
  pool.query.mockRejectedValueOnce(databaseError);
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

  try {
    const response = await request(app).get('/api/sponsor/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(503);
    expect(response.body.message).toMatch(/sponsor tables/i);
  } finally {
    errorLog.mockRestore();
  }
});
