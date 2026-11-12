const express = require('express');
const request = require('supertest');
const { createSupportRouter } = require('./support');
const { createSupportEmailSender } = require('./support-email');
function appFor(role, pool, send = jest.fn().mockResolvedValue()) {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.userRole = role; req.userId = 12; next(); });
  app.use('/support', createSupportRouter(pool, send, {}));
  return app;
}
function connection(rows) {
  return { beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
    query: jest.fn().mockResolvedValue([{}]).mockResolvedValueOnce([rows]) };
}
test.each(['Driver', 'Sponsor'])('%s can create a ticket even when email fails', async role => {
  const db = connection([{ name: 'User', username: 'user@example.com' }]);
  db.query.mockResolvedValueOnce([{ insertId: 42 }]);
  const send = jest.fn().mockRejectedValue(new Error('Unavailable'));
  const pool = { getConnection: jest.fn().mockResolvedValue(db), query: jest.fn() };
  const result = await request(appFor(role, pool, send)).post('/support').send({ subject: 'Help', message: 'Cannot log in on my phone' });
  expect(result.status).toBe(201); expect(result.body).toMatchObject({ ticketId: 42, emailSent: false });
  expect(db.commit).toHaveBeenCalled(); expect(db.rollback).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(2);
  expect(db.commit.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
});
test('ticket creation rolls back if the first message cannot be stored', async () => {
  const db = connection([{ name: 'User', username: 'user@example.com' }]);
  db.query.mockResolvedValueOnce([{ insertId: 42 }]).mockRejectedValueOnce(new Error('DB failure'));
  const send = jest.fn();
  const result = await request(appFor('Driver', { getConnection: async () => db }, send)).post('/support').send({ subject: 'Help', message: 'Problem' });
  expect(result.status).toBe(500); expect(db.rollback).toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
});
test.each(['Driver', 'Sponsor'])('%s cannot read another user ticket', async role => {
  const pool = { query: jest.fn().mockResolvedValue([[]]) };
  const response = await request(appFor(role, pool)).get('/support/99/messages');
  expect(response.status).toBe(404);
  expect(pool.query.mock.calls[0][1]).toEqual(['99', role, 12]);
  expect(pool.query.mock.calls[0][0]).toContain('t.requester_id = ?');
  expect(pool.query).toHaveBeenCalledTimes(1);
});
test('unauthorized replies never write a message', async () => {
  const db = connection([]);
  const result = await request(appFor('Driver', { getConnection: async () => db })).post('/support/99/messages').send({ message: 'Hello' });
  expect(result.status).toBe(404); expect(db.query).toHaveBeenCalledTimes(1); expect(db.rollback).toHaveBeenCalled();
});
test('closed tickets reject replies', async () => {
  const db = connection([{ ticket_id: 42, requester_id: 12, status: 'CLOSED' }]);
  const result = await request(appFor('Admin', { getConnection: async () => db })).post('/support/42/messages').send({ message: 'Hello' });
  expect(result.status).toBe(409); expect(db.query).toHaveBeenCalledTimes(1);
});
test('admin reply notifies the requester', async () => {
  const db = connection([{ ticket_id: 42, requester_id: 23, status: 'OPEN' }]);
  const result = await request(appFor('Admin', { getConnection: async () => db })).post('/support/42/messages').send({ message: 'We can help' });
  expect(result.status).toBe(201); expect(db.commit).toHaveBeenCalled();
  expect(db.query.mock.calls[3][1][0]).toBe(23);
});
test('only admins can close tickets', async () => {
  const pool = { query: jest.fn() };
  const result = await request(appFor('Sponsor', pool)).patch('/support/42/status').send({ status: 'CLOSED' });
  expect(result.status).toBe(403); expect(pool.query).not.toHaveBeenCalled();
});
test('blank descriptions and invalid ticket ids are rejected before database access', async () => {
  const pool = { query: jest.fn(), getConnection: jest.fn() };
  expect((await request(appFor('Driver', pool)).post('/support').send({ subject: 'Help', message: ' ' })).status).toBe(400);
  expect((await request(appFor('Driver', pool)).get('/support/no/messages')).status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled(); expect(pool.getConnection).not.toHaveBeenCalled();
});
test('Mailtrap uses server credentials and rejects failed delivery', async () => {
  const fetch = jest.fn().mockResolvedValue({ ok: true });
  const send = createSupportEmailSender({ MAILTRAP_API_TOKEN: 'test-token' }, fetch);
  await send({ to: 'user@example.com', subject: 'Ticket', text: 'Saved' });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  expect(JSON.parse(fetch.mock.calls[0][1].body).from.email).toBe('support@welcometochilis.cpsc4911.com');
  fetch.mockResolvedValue({ ok: false, status: 401 });
  await expect(send({})).rejects.toThrow('HTTP 401');
});
