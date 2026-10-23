const express = require('express');

function createSponsorApplicationsRouter(pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (req.userRole !== 'Sponsor') {
      return res.status(403).json({ message: 'Sponsor access required' });
    }

    try {
      const [sponsorUsers] = await pool.query(
        'SELECT sponsor_id FROM SponsorUsers WHERE user_id = ? LIMIT 1',
        [req.userId]
      );
      if (sponsorUsers.length === 0) {
        return res.status(403).json({ message: 'No sponsor organization is linked to this account' });
      }

      const [applications] = await pool.query(
        `SELECT a.application_id, a.driver_id, u.name AS driver_name, a.applied_at
         FROM DriverApplications a
         JOIN Users u ON u.user_id = a.driver_id
         WHERE a.sponsor_id = ? AND a.status = 'PENDING'
         ORDER BY a.applied_at ASC, a.application_id ASC`,
        [sponsorUsers[0].sponsor_id]
      );

      return res.json({ applications: applications.map((application) => ({
        applicationId: application.application_id,
        driverId: application.driver_id,
        driverName: application.driver_name,
        appliedAt: application.applied_at,
        status: 'PENDING',
      })) });
    } catch (error) {
      console.error('List sponsor applications error:', error);
      return res.status(500).json({ message: 'Unable to load applications' });
    }
  });

  return router;
}

module.exports = { createSponsorApplicationsRouter };
