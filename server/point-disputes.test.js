const express = require('express');
const request = require('supertest');
const { createPointDisputesRouter } = require('./point-disputes');

function appFor(role, pool) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.userRole = role;
    req.userId = 12;
    next();
  });
  app.use('/disputes', createPointDisputesRouter(pool));
  return app;
}

test('only a driver can open a dispute', async () => {
  const pool = { getConnection: jest.fn() };
  const result = await request(appFor('Sponsor', pool))
    .post('/disputes')
    .send({ pointId: 1, message: 'Please review' });
  expect(result.status).toBe(403);
  expect(pool.getConnection).not.toHaveBeenCalled();
});

test('a driver cannot dispute another driver’s point removal', async () => {
  const connection = {
    beginTransaction: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValueOnce([[]]),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const result = await request(appFor('Driver', pool))
    .post('/disputes')
    .send({ pointId: 5, message: 'Please review' });
  expect(result.status).toBe(404);
  expect(connection.query.mock.calls[0][1]).toEqual([5, 12]);
  expect(connection.rollback).toHaveBeenCalled();
});

test('sponsor decision checks organization access and does not decide an unavailable dispute', async () => {
  const connection = {
    beginTransaction: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValueOnce([[]]),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const result = await request(appFor('Sponsor', pool))
    .patch('/disputes/42/decision')
    .send({ status: 'ACCEPTED' });
  expect(result.status).toBe(404);
  expect(connection.query.mock.calls[0][0]).toContain('su.sponsor_id = d.sponsor_id');
  expect(connection.query).toHaveBeenCalledTimes(1);
});

test('a closed dispute cannot receive messages', async () => {
  const connection = {
    beginTransaction: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValueOnce([[{ status: 'DENIED' }]]),
  };
  const pool = { getConnection: jest.fn().mockResolvedValue(connection) };
  const result = await request(appFor('Driver', pool))
    .post('/disputes/42/messages')
    .send({ message: 'Hello' });
  expect(result.status).toBe(409);
  expect(connection.query).toHaveBeenCalledTimes(1);
});

test('acceptance restores the original removal in the same transaction', async () => {
  const connection = {
    beginTransaction: jest.fn(),
    rollback: jest.fn(),
    commit: jest.fn(),
    release: jest.fn(),
    query: jest
      .fn()
      .mockResolvedValueOnce([
        [{ dispute_id: 42, point_id: 5, driver_id: 8, sponsor_id: 3, status: 'OPEN' }],
      ])
      .mockResolvedValueOnce([[{ point_change: -25 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValue([{}]),
  };
  const result = await request(
    appFor('Sponsor', { getConnection: jest.fn().mockResolvedValue(connection) }),
  )
    .patch('/disputes/42/decision')
    .send({ status: 'ACCEPTED' });
  expect(result.status).toBe(200);
  expect(result.body.restoredPoints).toBe(25);
  expect(connection.query.mock.calls[2][1]).toEqual([25, 8]);
  expect(connection.query.mock.calls[3][1]).toEqual([
    8,
    3,
    25,
    'Restored after accepted dispute #42',
  ]);
  expect(connection.commit).toHaveBeenCalled();
});

test('an already decided dispute cannot restore points again', async () => {
  const connection = {
    beginTransaction: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockResolvedValueOnce([[{ status: 'ACCEPTED' }]]),
  };
  const result = await request(
    appFor('Sponsor', { getConnection: jest.fn().mockResolvedValue(connection) }),
  )
    .patch('/disputes/42/decision')
    .send({ status: 'ACCEPTED' });
  expect(result.status).toBe(409);
  expect(connection.query).toHaveBeenCalledTimes(1);
  expect(connection.rollback).toHaveBeenCalled();
});

test('denying a dispute does not restore points', async () => {
  const connection = {
    beginTransaction: jest.fn(),
    rollback: jest.fn(),
    commit: jest.fn(),
    release: jest.fn(),
    query: jest
      .fn()
      .mockResolvedValueOnce([[{ dispute_id: 42, driver_id: 8, status: 'OPEN' }]])
      .mockResolvedValue([{}]),
  };
  const result = await request(
    appFor('Sponsor', { getConnection: jest.fn().mockResolvedValue(connection) }),
  )
    .patch('/disputes/42/decision')
    .send({ status: 'DENIED' });
  expect(result.body.restoredPoints).toBe(0);
  expect(
    connection.query.mock.calls.every(
      ([sql]) => !sql.includes('UPDATE Drivers') && !sql.includes('INSERT INTO DriverPoints'),
    ),
  ).toBe(true);
});
