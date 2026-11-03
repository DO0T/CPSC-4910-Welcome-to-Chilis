const request = require('supertest');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const connection = {
  query: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn()
};
const pool = { query: jest.fn(), getConnection: jest.fn() };
mysql.createPool.mockReturnValue(pool);

const app = require('./server');

const SPONSOR_ORG = { sponsor_id: 7, company_name: 'Acme Trucking', point_value: 0.01 };

beforeEach(() => {
  pool.query.mockReset();
  connection.query.mockReset();
  pool.getConnection.mockResolvedValue(connection);
  bcrypt.compare.mockResolvedValue(true);
  bcrypt.hash.mockResolvedValue('new-hash');
});

async function loginAsSponsor() {
  pool.query
    .mockResolvedValueOnce([[
      { user_id: 50, username: 'sponsor@example.com', role: 'Sponsor', password_hash: 'hash' }
    ]])
    .mockResolvedValueOnce([{}]);

  const response = await request(app)
    .post('/api/login')
    .send({ username: 'sponsor@example.com', password: 'password' });

  expect(response.statusCode).toBe(200);
  pool.query.mockReset();
  return response.body.token;
}

async function loginAsDriver() {
  pool.query
    .mockResolvedValueOnce([[
      { user_id: 12, username: 'driver@example.com', role: 'Driver', password_hash: 'hash' }
    ]])
    .mockResolvedValueOnce([{}]);

  const response = await request(app)
    .post('/api/login')
    .send({ username: 'driver@example.com', password: 'password' });

  pool.query.mockReset();
  return response.body.token;
}

test('drivers cannot use sponsor routes', async () => {
  const token = await loginAsDriver();

  const response = await request(app)
    .get('/api/sponsor/drivers')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});

test('sponsor can review their own sponsor info', async () => {
  const token = await loginAsSponsor();

  pool.query
    .mockResolvedValueOnce([[SPONSOR_ORG]])
    .mockResolvedValueOnce([[{ user_id: 50, name: 'Sam Sponsor', username: 'sponsor@example.com', profile_picture_url: null }]])
    .mockResolvedValueOnce([[{ sponsor_user_count: 2, driver_count: 5 }]])
    .mockResolvedValueOnce([[{ user_id: 50, name: 'Sam Sponsor', username: 'sponsor@example.com' }]]);

  const response = await request(app)
    .get('/api/sponsor/me')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(response.body.organization).toEqual(expect.objectContaining({
    id: 7,
    companyName: 'Acme Trucking',
    driverCount: 5
  }));
});

test('sponsor can update their sponsor info', async () => {
  const token = await loginAsSponsor();

  pool.query
    .mockResolvedValueOnce([[SPONSOR_ORG]]) // requireSponsor
    .mockResolvedValueOnce([[]]) // duplicate name check
    .mockResolvedValueOnce([{ affectedRows: 1 }]); // update

  const response = await request(app)
    .put('/api/sponsor/organization')
    .set('Authorization', `Bearer ${token}`)
    .send({ companyName: 'Acme Logistics', pointValue: 0.02 });

  expect(response.statusCode).toBe(200);
  const [query, params] = pool.query.mock.calls[2];
  expect(query).toContain('UPDATE Sponsors');
  expect(params).toEqual(['Acme Logistics', 0.02, 7]);
});

test('sponsor info update rejects a non-positive point value', async () => {
  const token = await loginAsSponsor();
  pool.query.mockResolvedValueOnce([[SPONSOR_ORG]]);

  const response = await request(app)
    .put('/api/sponsor/organization')
    .set('Authorization', `Bearer ${token}`)
    .send({ pointValue: -1 });

  expect(response.statusCode).toBe(400);
});

test('sponsor can review the drivers in their organization', async () => {
  const token = await loginAsSponsor();

  pool.query
    .mockResolvedValueOnce([[SPONSOR_ORG]])
    .mockResolvedValueOnce([[
      { user_id: 12, name: 'Dana Driver', username: 'driver@example.com', active_sponsor_id: 7, points: '150', last_point_change: null }
    ]]);

  const response = await request(app)
    .get('/api/sponsor/drivers')
    .set('Authorization', `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual([
    expect.objectContaining({ id: 12, points: 150, pointsDollarValue: 1.5, isActiveSponsor: true })
  ]);
});

test('sponsor can add a new driver to their organization', async () => {
  const token = await loginAsSponsor();

  pool.query.mockResolvedValueOnce([[SPONSOR_ORG]]);
  connection.query
    .mockResolvedValueOnce([{ insertId: 99 }]) // Users
    .mockResolvedValueOnce([{}]) // Drivers
    .mockResolvedValueOnce([{}]) // DriverSponsorships
    .mockResolvedValueOnce([{}]); // AuditLog

  const response = await request(app)
    .post('/api/sponsor/drivers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New Driver', email: 'NEW@example.com', password: 'TempPass123' });

  expect(response.statusCode).toBe(201);
  expect(response.body.driver).toEqual({ id: 99, name: 'New Driver', email: 'new@example.com' });
  expect(connection.query.mock.calls[1][1]).toEqual([99, 7]);
  expect(connection.commit).toHaveBeenCalled();
});

test('sponsor cannot view as a driver outside their organization', async () => {
  const token = await loginAsSponsor();

  pool.query
    .mockResolvedValueOnce([[SPONSOR_ORG]])
    .mockResolvedValueOnce([[{ user_id: 30, name: 'Other Driver', username: 'other@example.com', role: 'Driver' }]])
    .mockResolvedValueOnce([[]]); // not a member

  const response = await request(app)
    .post('/api/sponsor/impersonate')
    .set('Authorization', `Bearer ${token}`)
    .send({ driverId: 30 });

  expect(response.statusCode).toBe(403);
});

test('sponsor can view the site as one of their drivers and return', async () => {
  const token = await loginAsSponsor();

  pool.query
    .mockResolvedValueOnce([[SPONSOR_ORG]])
    .mockResolvedValueOnce([[{ user_id: 12, name: 'Dana Driver', username: 'driver@example.com', role: 'Driver' }]])
    .mockResolvedValueOnce([[{ found: 1 }]]);

  const start = await request(app)
    .post('/api/sponsor/impersonate')
    .set('Authorization', `Bearer ${token}`)
    .send({ driverId: 12 });

  expect(start.statusCode).toBe(200);
  expect(start.body.role).toBe('Driver');

  // The session now acts as the driver
  pool.query.mockResolvedValueOnce([[
    { user_id: 12, name: 'Dana Driver', username: 'driver@example.com', role: 'Driver', point_alerts_enabled: 1 }
  ]]);
  const session = await request(app)
    .get('/api/session')
    .set('Authorization', `Bearer ${token}`);

  expect(session.body.userId).toBe(12);
  expect(session.body.role).toBe('Driver');
  expect(session.body.isAdmin).toBe(false);
  expect(session.body.sponsorImpersonating).toEqual(expect.objectContaining({ userId: 12 }));

  // While viewing as a driver, sponsor-only routes are blocked
  const blocked = await request(app)
    .get('/api/sponsor/drivers')
    .set('Authorization', `Bearer ${token}`);
  expect(blocked.statusCode).toBe(403);

  const stop = await request(app)
    .post('/api/sponsor/stop-impersonating')
    .set('Authorization', `Bearer ${token}`);

  expect(stop.statusCode).toBe(200);
  expect(stop.body.role).toBe('Sponsor');
});

test('sponsor points always go to the sponsor\'s own organization', async () => {
  const token = await loginAsSponsor();

  connection.query
    .mockResolvedValueOnce([[{ user_id: 12, sponsor_id: 3, total_points: 0, username: 'driver@example.com', point_alerts_enabled: 0 }]]) // driver (active sponsor is 3)
    .mockResolvedValueOnce([[SPONSOR_ORG]]) // sponsor org = 7
    .mockResolvedValueOnce([[{ found: 1 }]]) // membership in 7
    .mockResolvedValueOnce([{}]) // UPDATE Drivers
    .mockResolvedValueOnce([{}]) // INSERT DriverPoints
    .mockResolvedValueOnce([{}]) // AuditLog
    .mockResolvedValueOnce([[{ total_points: -25 }]]); // new total

  const response = await request(app)
    .post('/api/driver-points')
    .set('Authorization', `Bearer ${token}`)
    .send({ driver_id: 12, point_change: -25, reason: 'Speeding' });

  expect(response.statusCode).toBe(200);
  expect(response.body.total_points).toBe(-25);

  const ledgerCall = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO DriverPoints'));
  expect(ledgerCall[1]).toEqual([12, 7, -25, 'Speeding']);
});

test('sponsor cannot drop a driver from another organization', async () => {
  const token = await loginAsSponsor();

  connection.query
    .mockResolvedValueOnce([[{ user_id: 30, sponsor_id: 3, name: 'Other', email: 'other@example.com', company_name: 'Other Co' }]])
    .mockResolvedValueOnce([[SPONSOR_ORG]])
    .mockResolvedValueOnce([[]]); // not a member of org 7

  const response = await request(app)
    .post('/api/admin/drivers/30/drop')
    .set('Authorization', `Bearer ${token}`)
    .send({ reason: 'test' });

  expect(response.statusCode).toBe(403);
  expect(connection.query.mock.calls.some(([sql]) => sql.includes('UPDATE Drivers'))).toBe(false);
});

test('sponsor dropping a driver removes the membership for their own organization', async () => {
  const token = await loginAsSponsor();

  connection.query
    .mockResolvedValueOnce([[{ user_id: 12, sponsor_id: 7, name: 'Dana', email: 'driver@example.com', company_name: 'Acme Trucking' }]])
    .mockResolvedValueOnce([[SPONSOR_ORG]])
    .mockResolvedValueOnce([[{ found: 1 }]])
    .mockResolvedValueOnce([{}]) // delete membership
    .mockResolvedValueOnce([{}]) // update drivers
    .mockResolvedValueOnce([{}]); // audit log

  const response = await request(app)
    .post('/api/admin/drivers/12/drop')
    .set('Authorization', `Bearer ${token}`)
    .send({ reason: 'Left the company' });

  expect(response.statusCode).toBe(200);
  const deleteCall = connection.query.mock.calls.find(([sql]) => sql.includes('DELETE FROM DriverSponsorships'));
  expect(deleteCall[1]).toEqual([12, 7]);
});

test('sponsor assigning a driver always uses their own organization', async () => {
  const token = await loginAsSponsor();

  pool.query.mockResolvedValueOnce([[SPONSOR_ORG]]);
  connection.query
    .mockResolvedValueOnce([[{ user_id: 12, name: 'Dana', username: 'driver@example.com' }]])
    .mockResolvedValueOnce([{}]) // Drivers
    .mockResolvedValueOnce([{}]) // DriverSponsorships
    .mockResolvedValueOnce([{}]); // audit

  const response = await request(app)
    .post('/api/admin/drivers/12/assign')
    .set('Authorization', `Bearer ${token}`)
    .send({ sponsorId: 999 });

  expect(response.statusCode).toBe(200);
  const membership = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO DriverSponsorships'));
  expect(membership[1]).toEqual([12, 7]);
});