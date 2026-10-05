const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn() }), { virtual: true });

const connection = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  query: jest.fn(),
};
const pool = { getConnection: jest.fn(), query: jest.fn() };
mysql.createPool.mockReturnValue(pool);
pool.getConnection.mockResolvedValue(connection);
bcrypt.hash.mockResolvedValue('hashed-password');

const app = require('./server');

beforeEach(() => {
  jest.clearAllMocks();
  pool.getConnection.mockResolvedValue(connection);
  bcrypt.hash.mockResolvedValue('hashed-password');
});

test('creates a sponsor, company, and sponsor membership in one transaction', async () => {
  connection.query
    .mockResolvedValueOnce([{ insertId: 12 }])
    .mockResolvedValueOnce([{ insertId: 7 }])
    .mockResolvedValueOnce([{}]);

  const response = await request(app).post('/api/signup').send({
    role: 'Sponsor', name: 'Alex Smith', email: 'ALEX@example.com',
    password: 'test-password', companyName: 'North Star Transport',
  });

  expect(response.statusCode).toBe(201);
  expect(response.body.role).toBe('Sponsor');
  expect(connection.query).toHaveBeenNthCalledWith(1, expect.stringContaining('INSERT INTO Users'),
    ['Alex Smith', 'alex@example.com', 'hashed-password', 'Sponsor', null]);
  expect(connection.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO Sponsors'),
    ['North Star Transport']);
  expect(connection.query).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO SponsorUsers'),
    [12, 7]);
  expect(connection.commit).toHaveBeenCalledTimes(1);
  expect(connection.release).toHaveBeenCalledTimes(1);
});

test('creates a driver without creating a sponsor', async () => {
  connection.query
    .mockResolvedValueOnce([{ insertId: 13 }])
    .mockResolvedValueOnce([{}]);

  const response = await request(app).post('/api/signup').send({
    role: 'Driver', name: 'Taylor Lee', email: 'taylor@example.com', password: 'test-password',
  });

  expect(response.statusCode).toBe(201);
  expect(connection.query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO Drivers'), [13]);
  expect(connection.commit).toHaveBeenCalledTimes(1);
});

test('rejects sponsor signup without a company name before writing', async () => {
  const response = await request(app).post('/api/signup').send({
    role: 'Sponsor', name: 'Alex Smith', email: 'alex@example.com', password: 'test-password',
  });

  expect(response.statusCode).toBe(400);
  expect(pool.getConnection).not.toHaveBeenCalled();
});
