const express = require('express');

function createDriverSponsorshipsRouter(pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (req.userRole !== 'Driver') {
      return res.status(403).json({ message: 'Driver access required' });
    }

    try {
      const [rows] = await pool.query(
        `SELECT s.sponsor_id, s.company_name, d.sponsor_id AS active_sponsor_id
         FROM DriverSponsorships ds
         JOIN Sponsors s ON s.sponsor_id = ds.sponsor_id
         JOIN Drivers d ON d.user_id = ds.driver_id
         WHERE ds.driver_id = ?
         ORDER BY s.company_name, s.sponsor_id`,
        [req.userId]
      );

      return res.json(rows.map((row) => ({
        sponsorId: row.sponsor_id,
        companyName: row.company_name,
        isActive: row.sponsor_id === row.active_sponsor_id,
      })));
    } catch (error) {
      console.error('List driver sponsorships error:', error);
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({ message: 'Driver sponsorship data is not set up yet.' });
      }
      return res.status(500).json({ message: 'Unable to load your sponsors.' });
    }
  });

  router.patch('/active', async (req, res) => {
    if (req.userRole !== 'Driver') {
      return res.status(403).json({ message: 'Driver access required' });
    }

    const sponsorId = Number(req.body?.sponsorId);
    if (!Number.isSafeInteger(sponsorId) || sponsorId <= 0) {
      return res.status(400).json({ message: 'Choose a valid sponsor' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [drivers] = await connection.query(
        'SELECT sponsor_id FROM Drivers WHERE user_id = ? FOR UPDATE',
        [req.userId]
      );
      if (drivers.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Driver account not found' });
      }

      const [memberships] = await connection.query(
        `SELECT s.company_name FROM DriverSponsorships ds
         JOIN Sponsors s ON s.sponsor_id = ds.sponsor_id
         WHERE ds.driver_id = ? AND ds.sponsor_id = ? LIMIT 1`,
        [req.userId, sponsorId]
      );
      if (memberships.length === 0) {
        await connection.rollback();
        return res.status(403).json({ message: 'You do not belong to that sponsor' });
      }

      if (Number(drivers[0].sponsor_id) !== sponsorId) {
        await connection.query(
          'UPDATE Drivers SET sponsor_id = ? WHERE user_id = ?',
          [sponsorId, req.userId]
        );
      }
      await connection.commit();
      return res.json({ activeSponsorId: sponsorId, companyName: memberships[0].company_name });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Switch driver sponsor error:', error);
      return res.status(500).json({ message: 'Unable to switch sponsors' });
    } finally {
      if (connection) connection.release();
    }
  });

  return router;
}

module.exports = { createDriverSponsorshipsRouter };
