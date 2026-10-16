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

async function loginAsAdmin() {
  pool.query
    .mockResolvedValueOnce([[
      {
        user_id: 99,
        username: 'admin@example.com',
        role: 'Admin',
        password_hash: 'hash'
      }
    ]])
    .mockResolvedValueOnce([{}]);

  const response = await request(app)
    .post('/api/login')
    .send({
      username: 'admin@example.com',
      password: 'password'
    });

  expect(response.statusCode).toBe(200);

  pool.query.mockReset();

  return response.body.token;
}

test('admin can view driver logs alphabetically', async () => {
  const token = await loginAsAdmin();

  pool.query.mockResolvedValueOnce([[
    {
      log_id: 2,
      username: 'alice@example.com',
      event_category: 'Login Attempt'
    },
    {
      log_id: 1,
      username: 'bob@example.com',
      event_category: 'Login Attempt'
    }
  ]]);

  const response = await request(app)
    .get('/api/audit-logs/drivers')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);

  expect(response.body).toEqual([
    expect.objectContaining({
      username: 'alice@example.com'
    }),
    expect.objectContaining({
      username: 'bob@example.com'
    })
  ]);

  expect(pool.query).toHaveBeenCalledTimes(1);

  const query = pool.query.mock.calls[0][0];

  expect(query).toContain("WHERE U.role = 'Driver'");
  expect(query).toContain("ORDER BY A.username ASC");
});

test('admin can view sponsor logs alphabetically', async () => {
  const token = await loginAsAdmin();

  pool.query.mockResolvedValueOnce([[
    {
      log_id: 2,
      username: 'alpha-sponsor@example.com',
      event_category: 'Login Attempt'
    },
    {
      log_id: 1,
      username: 'beta-sponsor@example.com',
      event_category: 'Login Attempt'
    }
  ]]);

  const response = await request(app)
    .get('/api/audit-logs/sponsors')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);

  expect(response.body).toEqual([
    expect.objectContaining({
      username: 'alpha-sponsor@example.com'
    }),
    expect.objectContaining({
      username: 'beta-sponsor@example.com'
    })
  ]);

  expect(pool.query).toHaveBeenCalledTimes(1);

  const query = pool.query.mock.calls[0][0];

  expect(query).toContain("WHERE U.role = 'Sponsor'");
  expect(query).toContain("ORDER BY A.username ASC");
});
