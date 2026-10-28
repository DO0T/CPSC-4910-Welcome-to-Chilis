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

test('listing sponsor applications requires a login session', async () => {
  const response = await request(app).get('/api/sponsor/applications');
  expect(response.statusCode).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('deciding an application requires a login session', async () => {
  const response = await request(app).patch('/api/sponsor/applications/11').send({ decision: 'APPROVED' });
  expect(response.statusCode).toBe(401);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('driver details and bulk decisions require a login session', async () => {
  const details = await request(app).get('/api/sponsor/applications/11');
  const bulk = await request(app).post('/api/sponsor/applications/bulk/decision')
    .send({ applicationIds: [11], decision: 'APPROVED' });
  expect(details.statusCode).toBe(401);
  expect(bulk.statusCode).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.getConnection).not.toHaveBeenCalled();
});
