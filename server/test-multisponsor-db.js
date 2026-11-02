// Database-backed integration check. All fixture data is rolled back.
// Run manually with: node test-multisponsor-db.js
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const request = require('supertest');
const pool = require('./db');
const { createDriverApplicationsRouter } = require('./driver-applications');
const { createSponsorApplicationsRouter } = require('./sponsor-applications');
const { createDriverSponsorshipsRouter } = require('./driver-sponsorships');
const { createDriverCatalogRouter } = require('./driver-catalog');

async function main() {
  const connection = await pool.getConnection();
  let began = false;
  try {
    const tables = ['Users', 'Drivers', 'Sponsors', 'SponsorUsers', 'DriverSponsorships', 'DriverApplications', 'SponsorCatalogItems', 'DriverPoints', 'AuditLog'];
    const [engines] = await connection.query(
      'SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)', [tables]
    );
    const [triggers] = await connection.query(
      'SELECT COUNT(*) AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE IN (?)', [tables]
    );
    assert.equal(engines.length, tables.length, 'Required tables must exist');
    assert.ok(engines.every((row) => row.ENGINE === 'InnoDB'), 'All fixture tables must support rollback');
    assert.equal(Number(triggers[0].n), 0, 'Triggers require review before this check can run');
    await connection.beginTransaction();
    began = true;

    // Routers normally commit their own transactions. Savepoints keep every
    // router operation inside the outer transaction, which is always rolled back.
    let savepoint = 0;
    const wrapped = {
      query: (...args) => connection.query(...args),
      async beginTransaction() { savepoint += 1; await connection.query(`SAVEPOINT integration_${savepoint}`); },
      async commit() { await connection.query(`RELEASE SAVEPOINT integration_${savepoint}`); },
      async rollback() { await connection.query(`ROLLBACK TO SAVEPOINT integration_${savepoint}`); },
      release() {},
    };
    const testPool = { query: (...args) => connection.query(...args), getConnection: async () => wrapped };
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.userId = Number(req.get('x-test-user')); req.userRole = req.get('x-test-role'); next(); });
    const audit = async (username, category, status, details, db) => db.query(
      'INSERT INTO AuditLog (username, event_category, status, details) VALUES (?, ?, ?, ?)', [username, category, status, details]
    );
    app.use('/driver/applications', createDriverApplicationsRouter(testPool, audit));
    app.use('/sponsor/applications', createSponsorApplicationsRouter(testPool));
    app.use('/driver/sponsorships', createDriverSponsorshipsRouter(testPool));
    app.use('/driver/catalog', createDriverCatalogRouter(testPool));

    const nonce = crypto.randomUUID();
    async function user(role) {
      const [result] = await connection.query('INSERT INTO Users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
        ['Integration fixture', `${crypto.randomUUID()}@example.invalid`, 'unused', role]);
      return result.insertId;
    }
    async function sponsor() {
      const [result] = await connection.query('INSERT INTO Sponsors (company_name, point_value) VALUES (?, ?)', [`Fixture ${crypto.randomUUID()}`, 1]);
      const sponsorUser = await user('Sponsor');
      await connection.query('INSERT INTO SponsorUsers (user_id, sponsor_id) VALUES (?, ?)', [sponsorUser, result.insertId]);
      return { id: result.insertId, user: sponsorUser };
    }
    const [a, b, c] = [await sponsor(), await sponsor(), await sponsor()];
    const driver = await user('Driver');
    await connection.query('INSERT INTO Drivers (user_id, sponsor_id, total_points) VALUES (?, ?, 30)', [driver, a.id]);
    await connection.query('INSERT INTO DriverSponsorships (driver_id, sponsor_id) VALUES (?, ?)', [driver, a.id]);
    await connection.query('INSERT INTO DriverPoints (driver_id, sponsor_id, point_change, reason) VALUES (?, ?, 10, ?), (?, ?, 20, ?)', [driver, a.id, 'Fixture A', driver, b.id, 'Fixture B']);
    for (const [s, title] of [[a, 'Fixture reward A'], [b, 'Fixture reward B']]) {
      await connection.query('INSERT INTO SponsorCatalogItems (sponsor_id, ebay_item_id, title, ebay_price, family_friendly_confirmed) VALUES (?, ?, ?, 10, 1)', [s.id, nonce, title]);
    }
    const as = (r, id, role) => r.set('x-test-user', String(id)).set('x-test-role', role);
    async function apply(sponsorId) {
      const response = await as(request(app).post('/driver/applications'), driver, 'Driver').send({ sponsorId });
      assert.equal(response.status, 201);
      return response.body.applicationId;
    }
    const approved = await apply(b.id);
    const denied = await apply(c.id);
    assert.equal((await as(request(app).patch(`/sponsor/applications/${approved}`), c.user, 'Sponsor').send({ decision: 'APPROVED' })).status, 404);
    assert.equal((await as(request(app).patch(`/sponsor/applications/${approved}`), b.user, 'Sponsor').send({ decision: 'APPROVED' })).status, 200);
    assert.equal((await as(request(app).patch(`/sponsor/applications/${denied}`), c.user, 'Sponsor').send({ decision: 'DENIED' })).status, 200);
    const [memberships] = await connection.query('SELECT sponsor_id FROM DriverSponsorships WHERE driver_id = ? ORDER BY sponsor_id', [driver]);
    assert.deepEqual(memberships.map((row) => row.sponsor_id).sort((x, y) => x - y), [a.id, b.id].sort((x, y) => x - y));
    for (const [s, title, expectedPoints] of [[a, 'Fixture reward A', 10], [b, 'Fixture reward B', 20], [a, 'Fixture reward A', 10]]) {
      assert.equal((await as(request(app).patch('/driver/sponsorships/active'), driver, 'Driver').send({ sponsorId: s.id })).status, 200);
      const catalog = await as(request(app).get('/driver/catalog'), driver, 'Driver');
      assert.equal(catalog.status, 200);
      assert.equal(catalog.body.sponsorId, s.id);
      assert.deepEqual(catalog.body.items.map((item) => item.title), [title]);
      const [points] = await connection.query('SELECT COALESCE(SUM(p.point_change), 0) AS total FROM Drivers d LEFT JOIN DriverPoints p ON p.driver_id = d.user_id AND p.sponsor_id = d.sponsor_id WHERE d.user_id = ?', [driver]);
      assert.equal(Number(points[0].total), expectedPoints);
    }
    console.log('Database integration passed: application isolation, approval, denial, memberships, switching, catalogs, and sponsor-tagged point totals.');
  } finally {
    if (began) await connection.rollback();
    connection.release();
    await pool.end();
    if (began) console.log('Fixture transaction rolled back.');
  }
}

main().catch((error) => { console.error('Database integration failed:', error.message); process.exitCode = 1; });
