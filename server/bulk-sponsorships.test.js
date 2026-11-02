const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const pool = { query: jest.fn(), getConnection: jest.fn() };
mysql.createPool.mockReturnValue(pool);
const app = require('./server');

async function loginSponsor() {
  pool.query.mockResolvedValueOnce([[{ user_id: 12, role: 'Sponsor', password_hash: 'hash' }]])
    .mockResolvedValueOnce([{}]);
  const response = await request(app).post('/api/login').send({ username: 'sponsor@example.com', password: 'password' });
  pool.query.mockReset();
  return response.body.token;
}

beforeEach(() => {
  pool.query.mockReset();
  pool.getConnection.mockReset();
  bcrypt.compare.mockResolvedValue(true);
  bcrypt.hash.mockResolvedValue('hash');
});

function connectionFor(memberships) {
  return { beginTransaction: jest.fn(), rollback: jest.fn(), commit: jest.fn(), release: jest.fn(), query: jest.fn()
    .mockResolvedValueOnce([[{ sponsor_id: 7, company_name: 'Acme' }]])
    .mockResolvedValueOnce([[{ sponsor_id: 7, company_name: 'Acme' }]])
    .mockResolvedValueOnce([[{ user_id: 42, role: 'Driver' }]])
    .mockResolvedValueOnce([[{ sponsor_id: 9 }]])
    .mockResolvedValueOnce([memberships])
    .mockResolvedValue([{}]) };
}

test('sponsor bulk upload preserves another active sponsor for their shared driver', async () => {
  const token = await loginSponsor();
  const connection = connectionFor([{ sponsor_id: 7 }, { sponsor_id: 9 }]);
  pool.getConnection.mockResolvedValueOnce(connection);
  const response = await request(app).post('/api/bulk-upload').set('Authorization', `Bearer ${token}`)
    .send({ fileContent: 'D||Taylor|Driver|driver@example.com|10|Safe driving' });
  expect(response.statusCode).toBe(200);
  expect(connection.commit).toHaveBeenCalledTimes(1);
  const upsert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO Drivers (user_id, sponsor_id, total_points)'));
  expect(upsert[0]).toContain('COALESCE(sponsor_id, VALUES(sponsor_id))');
  const ledger = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO DriverPoints'));
  expect(ledger[1]).toEqual([42, 7, 10, 'Safe driving']);
});

test('sponsor bulk upload skips a driver belonging only to another sponsor', async () => {
  const token = await loginSponsor();
  const connection = connectionFor([{ sponsor_id: 9 }]);
  pool.getConnection.mockResolvedValueOnce(connection);
  const response = await request(app).post('/api/bulk-upload').set('Authorization', `Bearer ${token}`)
    .send({ fileContent: 'D||Taylor|Driver|driver@example.com|10|Safe driving' });
  expect(response.statusCode).toBe(200);
  expect(connection.rollback).toHaveBeenCalledTimes(1);
  expect(connection.commit).not.toHaveBeenCalled();
  expect(connection.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO DriverPoints'))).toBe(false);
});
