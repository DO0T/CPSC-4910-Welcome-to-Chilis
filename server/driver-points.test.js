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

async function driverToken() {
  pool.query.mockResolvedValueOnce([[{ user_id: 12, role: 'Driver', password_hash: 'hash' }]])
    .mockResolvedValueOnce([{}]);
  const response = await request(app).post('/api/login').send({ username: 'driver@example.com', password: 'password' });
  pool.query.mockReset();
  return response.body.token;
}

test('returns active sponsor and separate unassigned balances for the logged-in driver', async () => {
  const token = await driverToken();
  pool.query.mockResolvedValueOnce([[{ sponsor_id: 7, total_points: '25', unassigned_points: '50' }]]);
  const response = await request(app).get('/api/driver/points').set('Authorization', `Bearer ${token}`);
  expect(response.body).toEqual({ sponsor_id: 7, total_points: 25, unassigned_points: 50 });
  expect(pool.query.mock.calls[0][1]).toEqual([12]);
  expect(pool.query.mock.calls[0][0]).toContain('p.sponsor_id = d.sponsor_id');
});

test('limits recent activity to the active sponsor and session driver', async () => {
  const token = await driverToken();
  pool.query.mockResolvedValueOnce([[]]);
  const response = await request(app).get('/api/driver/points-history').set('Authorization', `Bearer ${token}`);
  expect(response.statusCode).toBe(200);
  expect(pool.query.mock.calls[0][1]).toEqual([12, 12]);
  expect(pool.query.mock.calls[0][0]).toContain('sponsor_id = (SELECT sponsor_id FROM Drivers');
});
