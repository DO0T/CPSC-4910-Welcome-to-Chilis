const request = require('supertest');
const mysql = require('mysql2/promise');

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }));

const pool = { query: jest.fn(), getConnection: jest.fn() };
mysql.createPool.mockReturnValue(pool);
const app = require('./server');

test('submitting an application requires a login session', async () => {
  const response = await request(app).post('/api/driver/applications').send({ sponsorId: 7 });
  expect(response.statusCode).toBe(401);
  expect(pool.getConnection).not.toHaveBeenCalled();
});
