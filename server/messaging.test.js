const express = require('express');
const request = require('supertest');
const { createMessagingRouter } = require('./messaging');
function appFor(role, pool, id = 12) {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.userRole = role; req.userId = id; next(); });
  app.use('/messages', createMessagingRouter(pool)); return app;
}
function transaction() {
  const db = { query: jest.fn().mockResolvedValue([{ insertId: 70 }]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
  return { db, pool: { getConnection: jest.fn().mockResolvedValue(db) } };
}
const driver = { user_id: 23, role: 'Driver' };
const thread = { conversation_id: 70, sender_id: 12, recipient_id: 23, sender_role: 'Sponsor', recipient_role: 'Driver', driver_replies_enabled: 1 };
test('bulk sponsor messages create separate conversations and respect notification preferences', async () => {
  const { db, pool } = transaction();
  db.query.mockResolvedValueOnce([[driver, { user_id: 24, role: 'Driver' }]])
    .mockResolvedValueOnce([{ insertId: 70 }]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}])
    .mockResolvedValueOnce([{ insertId: 71 }]);
  const response = await request(appFor('Sponsor', pool)).post('/messages').send({ recipientIds: [23, 24], subject: 'Schedule', message: 'New route', driverRepliesEnabled: false });
  expect(response.status).toBe(201); expect(response.body.conversationIds).toEqual([70, 71]);
  expect(db.query.mock.calls[1][1]).toEqual([12, 23, 'Sponsor', 'Driver', 'Schedule', false]);
  expect(db.query.mock.calls[4][1][1]).toBe(24);
  expect(db.query.mock.calls[3][0]).toContain('COALESCE(p.sponsor_messages_enabled, 1) = 1');
  expect(db.commit).toHaveBeenCalled();
});
test('a forged recipient rejects the whole bulk request before any insert', async () => {
  const { db, pool } = transaction(); db.query.mockResolvedValueOnce([[driver]]);
  const response = await request(appFor('Sponsor', pool)).post('/messages').send({ recipientIds: [23, 99], subject: 'Schedule', message: 'Hello' });
  expect(response.status).toBe(403); expect(db.query).toHaveBeenCalledTimes(1); expect(db.rollback).toHaveBeenCalled();
});
test('bulk delivery rolls back all conversations if a later insert fails', async () => {
  const { db, pool } = transaction();
  db.query.mockResolvedValueOnce([[driver, { user_id: 24, role: 'Driver' }]])
    .mockResolvedValueOnce([{ insertId: 70 }]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockRejectedValueOnce(new Error('DB failure'));
  const result = await request(appFor('Sponsor', pool)).post('/messages').send({ recipientIds: [23, 24], subject: 'Schedule', message: 'Hello' });
  expect(result.status).toBe(500); expect(db.rollback).toHaveBeenCalled(); expect(db.commit).not.toHaveBeenCalled(); expect(db.release).toHaveBeenCalled();
});
test.each(['Driver', 'Sponsor', 'Admin'])('%s cannot read an unrelated conversation', async role => {
  const pool = { query: jest.fn().mockResolvedValue([[]]) };
  const response = await request(appFor(role, pool)).get('/messages/70/messages');
  expect(response.status).toBe(404); expect(pool.query).toHaveBeenCalledTimes(1);
  expect(pool.query.mock.calls[0][1]).toEqual(['70', 12, role, 12, role]);
});
test('disabled driver replies are enforced by the API', async () => {
  const { db, pool } = transaction(); db.query.mockResolvedValueOnce([[{ ...thread, driver_replies_enabled: 0 }]]);
  const result = await request(appFor('Driver', pool, 23)).post('/messages/70/messages').send({ message: 'Reply' });
  expect(result.status).toBe(403); expect(db.query).toHaveBeenCalledTimes(1); expect(db.rollback).toHaveBeenCalled();
});
test('former sponsorship cannot send further replies', async () => {
  const { db, pool } = transaction(); db.query.mockResolvedValueOnce([[thread]]).mockResolvedValueOnce([[]]);
  const result = await request(appFor('Sponsor', pool)).post('/messages/70/messages').send({ message: 'Reply' });
  expect(result.status).toBe(403); expect(db.query).toHaveBeenCalledTimes(2); expect(db.commit).not.toHaveBeenCalled();
});
test('sponsor replies create preference-filtered driver alerts', async () => {
  const { db, pool } = transaction(); db.query.mockResolvedValueOnce([[thread]]).mockResolvedValueOnce([[driver]]);
  const result = await request(appFor('Sponsor', pool)).post('/messages/70/messages').send({ message: 'Reply' });
  expect(result.status).toBe(201);
  expect(db.query.mock.calls[4][0]).toContain('sponsor_messages_enabled'); expect(db.query.mock.calls[4][1][1]).toBe(23);
});
test('drivers can reply to administrator conversations without a sponsor relationship', async () => {
  const { db, pool } = transaction(); db.query.mockResolvedValueOnce([[{ ...thread, sender_role: 'Admin' }]]);
  const result = await request(appFor('Driver', pool, 23)).post('/messages/70/messages').send({ message: 'Thanks' });
  expect(result.status).toBe(201); expect(db.query.mock.calls[3][1][0]).toBe(12); expect(db.commit).toHaveBeenCalled();
});
test.each(['Driver', 'Sponsor'])('admins can initiate a message to a %s', async recipientRole => {
  const { db, pool } = transaction(); db.query.mockResolvedValueOnce([[{ user_id: 23, role: recipientRole }]]);
  const result = await request(appFor('Admin', pool)).post('/messages').send({ recipientIds: [23], subject: 'Notice', message: 'Hello' });
  expect(result.status).toBe(201); expect(db.query.mock.calls[1][1]).toEqual([12, 23, 'Admin', recipientRole, 'Notice', true]);
  expect(db.query.mock.calls[3][0]).not.toContain('sponsor_messages_enabled');
});
test('drivers can initiate messages to an eligible sponsor', async () => {
  const { db, pool } = transaction(); db.query.mockResolvedValueOnce([[{ user_id: 23, role: 'Sponsor' }]]);
  expect((await request(appFor('Driver', pool)).post('/messages').send({ recipientIds: [23], subject: 'Question', message: 'Hello' })).status).toBe(201);
});
test.each([true, false])('driver can persist notification preference %s', async enabled => {
  const pool = { query: jest.fn().mockResolvedValue([{}]) };
  const result = await request(appFor('Driver', pool)).put('/messages/preferences').send({ sponsorMessagesEnabled: enabled });
  expect(result.status).toBe(200); expect(result.body.sponsorMessagesEnabled).toBe(enabled); expect(pool.query.mock.calls[0][1]).toEqual([12, enabled]);
});
test('new drivers default to enabled notifications', async () => {
  const pool = { query: jest.fn().mockResolvedValue([[]]) };
  expect((await request(appFor('Driver', pool)).get('/messages/preferences')).body.sponsorMessagesEnabled).toBe(true);
});
test.each([true, false])('sponsors can set reply permission to %s only on their own driver conversation', async enabled => {
  const pool = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };
  const result = await request(appFor('Sponsor', pool)).patch('/messages/70/replies').send({ driverRepliesEnabled: enabled });
  expect(result.status).toBe(200); expect(pool.query.mock.calls[0][1]).toEqual([enabled, '70', 12, 'Sponsor', 12, 'Sponsor']);
});
test('driver cannot change reply permission', async () => {
  const pool = { query: jest.fn() };
  expect((await request(appFor('Driver', pool)).patch('/messages/70/replies').send({ driverRepliesEnabled: true })).status).toBe(403);
  expect(pool.query).not.toHaveBeenCalled();
});
test.each([
  { recipientIds: [23, 23], subject: 'Hi', message: 'Hi' },
  { recipientIds: ['23'], subject: 'Hi', message: 'Hi' },
  { recipientIds: [23], subject: ' ', message: 'Hi' },
  { recipientIds: [23], subject: 'Hi', message: 'x'.repeat(4001) },
])('invalid compose request is rejected', async body => {
  const pool = { getConnection: jest.fn() };
  expect((await request(appFor('Sponsor', pool)).post('/messages').send(body)).status).toBe(400);
  expect(pool.getConnection).not.toHaveBeenCalled();
});
test('driver contact list is restricted to linked sponsor accounts', async () => {
  const pool = { query: jest.fn().mockResolvedValue([[]]) };
  await request(appFor('Driver', pool)).get('/messages/contacts');
  expect(pool.query.mock.calls[0][0]).toContain("u.role = 'Sponsor'");
  expect(pool.query.mock.calls[0][0]).toContain('DriverSponsorships');
  expect(pool.query.mock.calls[0][1]).toEqual([12, 12]);
});
