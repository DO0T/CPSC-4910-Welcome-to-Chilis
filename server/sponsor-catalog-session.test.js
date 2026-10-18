const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn() }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }), { virtual: true });

const pool = { query: jest.fn(), getConnection: jest.fn() };
mysql.createPool.mockReturnValue(pool);
const app = require('./server');

beforeEach(() => {
  pool.query.mockReset();
  bcrypt.compare.mockResolvedValue(true);
});

test('catalog API requires a real login session', async () => {
  const response = await request(app).get('/api/sponsor/catalog');
  expect(response.statusCode).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('a driver session cannot read the sponsor catalog', async () => {
  pool.query.mockResolvedValueOnce([[{ user_id: 33, role: 'Driver', password_hash: 'hash' }]])
    .mockResolvedValueOnce([{}]);
  const login = await request(app).post('/api/login').send({ username: 'driver@example.com', password: 'password' });
  expect(login.statusCode).toBe(200);
  pool.query.mockReset();
  const response = await request(app).get('/api/sponsor/catalog')
    .set('Authorization', `Bearer ${login.body.token}`);
  expect(response.statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});
