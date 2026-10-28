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

  router.get('/:applicationId', async (req, res) => {
    if (req.userRole !== 'Sponsor') {
      return res.status(403).json({ message: 'Sponsor access required' });
    }
    const applicationId = Number(req.params.applicationId);
    if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({ message: 'Choose a valid application' });
    }

    try {
      const [sponsorUsers] = await pool.query(
        'SELECT sponsor_id FROM SponsorUsers WHERE user_id = ? LIMIT 1',
        [req.userId]
      );
      if (sponsorUsers.length === 0) {
        return res.status(403).json({ message: 'No sponsor organization is linked to this account' });
      }

      const [rows] = await pool.query(
        `SELECT a.application_id, a.driver_id, a.applied_at,
                u.name AS driver_name, u.username AS driver_email,
                u.profile_picture_url
         FROM DriverApplications a
         JOIN Users u ON u.user_id = a.driver_id
         WHERE a.application_id = ? AND a.sponsor_id = ? AND a.status = 'PENDING'
         LIMIT 1`,
        [applicationId, sponsorUsers[0].sponsor_id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Pending application not found' });
      }

      const row = rows[0];
      return res.json({
        applicationId: row.application_id,
        driverId: row.driver_id,
        driverName: row.driver_name,
        email: row.driver_email,
        profilePictureUrl: row.profile_picture_url || null,
        appliedAt: row.applied_at,
      });
    } catch (error) {
      console.error('Load sponsor application details error:', error);
      return res.status(500).json({ message: 'Unable to load driver information' });
    }
  });

  router.post('/bulk/decision', async (req, res) => {
    if (req.userRole !== 'Sponsor') {
      return res.status(403).json({ message: 'Sponsor access required' });
    }

    const { applicationIds, decision } = req.body || {};
    if (!Array.isArray(applicationIds) || applicationIds.length === 0 || applicationIds.length > 100 ||
        applicationIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(applicationIds).size !== applicationIds.length) {
      return res.status(400).json({ message: 'Select 1 to 100 different applications' });
    }
    if (decision !== 'APPROVED' && decision !== 'DENIED') {
      return res.status(400).json({ message: 'Choose approve or deny' });
    }

    const ids = [...applicationIds].sort((a, b) => a - b);
    const placeholders = ids.map(() => '?').join(', ');
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [sponsorUsers] = await connection.query(
        'SELECT sponsor_id FROM SponsorUsers WHERE user_id = ? LIMIT 1',
        [req.userId]
      );
      if (sponsorUsers.length === 0) {
        await connection.rollback();
        return res.status(403).json({ message: 'No sponsor organization is linked to this account' });
      }
      const sponsorId = sponsorUsers[0].sponsor_id;

      const [rows] = await connection.query(
        `SELECT application_id, driver_id, status FROM DriverApplications
         WHERE sponsor_id = ? AND application_id IN (${placeholders})
         ORDER BY application_id FOR UPDATE`,
        [sponsorId, ...ids]
      );
      if (rows.length !== ids.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'One or more applications were not found for this sponsor' });
      }
      if (rows.some((row) => row.status !== 'PENDING')) {
        await connection.rollback();
        return res.status(409).json({ message: 'One or more applications have already been decided. Refresh the page.' });
      }

      const [result] = await connection.query(
        `UPDATE DriverApplications SET status = ?, decided_at = NOW(), decided_by = ?
         WHERE sponsor_id = ? AND status = 'PENDING' AND application_id IN (${placeholders})`,
        [decision, req.userId, sponsorId, ...ids]
      );
      if (result.affectedRows !== ids.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Applications changed while processing. Refresh the page.' });
      }

      if (decision === 'APPROVED') {
        const values = rows.map(() => '(?, ?)').join(', ');
        await connection.query(
          `INSERT INTO DriverSponsorships (driver_id, sponsor_id) VALUES ${values}
           ON DUPLICATE KEY UPDATE sponsor_id = sponsor_id`,
          rows.flatMap((row) => [row.driver_id, sponsorId])
        );
      }

      await connection.commit();
      return res.json({ applicationIds: ids, status: decision, count: ids.length });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Decide sponsor applications in bulk error:', error);
      return res.status(500).json({ message: 'Unable to update applications' });
    } finally {
      if (connection) connection.release();
    }
  });

  router.patch('/:applicationId', async (req, res) => {
    if (req.userRole !== 'Sponsor') {
      return res.status(403).json({ message: 'Sponsor access required' });
    }

    const applicationId = Number(req.params.applicationId);
    const decision = req.body?.decision;
    if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({ message: 'Choose a valid application' });
    }
    if (decision !== 'APPROVED' && decision !== 'DENIED') {
      return res.status(400).json({ message: 'Choose approve or deny' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [sponsorUsers] = await connection.query(
        'SELECT sponsor_id FROM SponsorUsers WHERE user_id = ? LIMIT 1',
        [req.userId]
      );
      if (sponsorUsers.length === 0) {
        await connection.rollback();
        return res.status(403).json({ message: 'No sponsor organization is linked to this account' });
      }

      const sponsorId = sponsorUsers[0].sponsor_id;
      const [applications] = await connection.query(
        'SELECT application_id, driver_id, status FROM DriverApplications WHERE application_id = ? AND sponsor_id = ? FOR UPDATE',
        [applicationId, sponsorId]
      );
      if (applications.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Application not found' });
      }
      if (applications[0].status !== 'PENDING') {
        await connection.rollback();
        return res.status(409).json({ message: 'This application has already been decided' });
      }

      await connection.query(
        'UPDATE DriverApplications SET status = ?, decided_at = NOW(), decided_by = ? WHERE application_id = ? AND sponsor_id = ?',
        [decision, req.userId, applicationId, sponsorId]
      );
      if (decision === 'APPROVED') {
        await connection.query(
          `INSERT INTO DriverSponsorships (driver_id, sponsor_id) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE sponsor_id = sponsor_id`,
          [applications[0].driver_id, sponsorId]
        );
      }
      await connection.commit();

      return res.json({ applicationId, status: decision, driverId: applications[0].driver_id });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Decide sponsor application error:', error);
      return res.status(500).json({ message: 'Unable to update application' });
    } finally {
      if (connection) connection.release();
    }
  });

  return router;
}

module.exports = { createSponsorApplicationsRouter };
