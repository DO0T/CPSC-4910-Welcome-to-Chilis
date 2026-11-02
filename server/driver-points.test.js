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
  pool.getConnection.mockReset();
  bcrypt.compare.mockResolvedValue(true);
});

async function driverToken(role = 'Driver') {
  pool.query.mockResolvedValueOnce([[{ user_id: 12, role, password_hash: 'hash' }]])
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

test('limits the full driver points list to administrators', async () => {
  expect((await request(app).get('/api/driver-points')).statusCode).toBe(401);
  const token = await driverToken();
  expect((await request(app).get('/api/driver-points').set('Authorization', `Bearer ${token}`)).statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('drivers cannot change another driver\'s points', async () => {
  const token = await driverToken();
  const response = await request(app).post('/api/driver-points').set('Authorization', `Bearer ${token}`)
    .send({ driver_id: 42, sponsor_id: 7, point_change: 10, reason: 'test' });
  expect(response.statusCode).toBe(403);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('sponsors cannot change points for another organization', async () => {
  const token = await driverToken('Sponsor');
  const connection = { beginTransaction: jest.fn(), rollback: jest.fn(), release: jest.fn(), query: jest.fn()
    .mockResolvedValueOnce([[{ user_id: 42, sponsor_id: 7 }]])
    .mockResolvedValueOnce([[]]) };
  pool.getConnection.mockResolvedValueOnce(connection);
  const response = await request(app).post('/api/driver-points').set('Authorization', `Bearer ${token}`)
    .send({ driver_id: 42, sponsor_id: 7, point_change: 10, reason: 'test' });
  expect(response.statusCode).toBe(403);
  expect(connection.query.mock.calls[1][1]).toEqual([12, 42, 7]);
  expect(connection.rollback).toHaveBeenCalled();
  expect(connection.query).toHaveBeenCalledTimes(2);
});

test('a sponsor may adjust points for a driver in their own organization', async () => {
  const token = await driverToken('Sponsor');
  const connection = { beginTransaction: jest.fn(), rollback: jest.fn(), commit: jest.fn(), release: jest.fn(), query: jest.fn()
    .mockResolvedValueOnce([[{ user_id: 42, sponsor_id: 9, username: 'driver@example.com', point_alerts_enabled: 0 }]])
    .mockResolvedValueOnce([[{ driver_id: 42 }]])
    .mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}])
    .mockResolvedValueOnce([[{ total_points: 50 }]]) };
  pool.getConnection.mockResolvedValueOnce(connection);
  const response = await request(app).post('/api/driver-points').set('Authorization', `Bearer ${token}`)
    .send({ driver_id: 42, sponsor_id: 7, point_change: 10, reason: 'Safe driving' });
  expect(response.statusCode).toBe(200);
  expect(connection.query.mock.calls[1][1]).toEqual([12, 42, 7]);
  expect(connection.query.mock.calls[3][1]).toEqual([42, 7, 10, 'Safe driving']);
  expect(connection.query.mock.calls[5][1]).toEqual([42, 7]);
  expect(connection.commit).toHaveBeenCalled();
});

test('limits recent activity to the active sponsor and session driver', async () => {
  const token = await driverToken();
  pool.query.mockResolvedValueOnce([[]]);
  const response = await request(app).get('/api/driver/points-history').set('Authorization', `Bearer ${token}`);
  expect(response.statusCode).toBe(200);
  expect(pool.query.mock.calls[0][1]).toEqual([12, 12]);
  expect(pool.query.mock.calls[0][0]).toContain('sponsor_id = (SELECT sponsor_id FROM Drivers');
});
