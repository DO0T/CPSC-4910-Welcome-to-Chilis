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

  return router;
}

module.exports = { createDriverSponsorshipsRouter };
