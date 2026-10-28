const express = require('express');

function createDriverApplicationsRouter(pool) {
  const router = express.Router();

  router.get('/sponsors', async (req, res) => {
    if (req.userRole !== 'Driver') {
      return res.status(403).json({ message: 'Driver access required' });
    }

    try {
      const [drivers] = await pool.query(
        'SELECT sponsor_id FROM Drivers WHERE user_id = ? LIMIT 1',
        [req.userId]
      );
      if (drivers.length === 0) {
        return res.status(404).json({ message: 'Driver account not found' });
      }

      const [sponsors] = await pool.query(
        `SELECT s.sponsor_id, s.company_name, ds.driver_id AS member_driver_id,
                a.status, a.applied_at, a.decided_at,
                DATE_ADD(a.decided_at, INTERVAL 30 DAY) AS can_reapply_at,
                a.decided_at <= NOW() - INTERVAL 30 DAY AS cooldown_complete
         FROM Sponsors s
         LEFT JOIN DriverSponsorships ds ON ds.driver_id = ? AND ds.sponsor_id = s.sponsor_id
         LEFT JOIN DriverApplications a ON a.application_id = (
           SELECT application_id FROM DriverApplications
           WHERE driver_id = ? AND sponsor_id = s.sponsor_id
           ORDER BY applied_at DESC, application_id DESC LIMIT 1
         )
         ORDER BY s.company_name, s.sponsor_id`,
        [req.userId, req.userId]
      );

      return res.json(sponsors.map((sponsor) => {
        const isCurrent = Number(drivers[0].sponsor_id) === sponsor.sponsor_id;
        const isMember = sponsor.member_driver_id != null;
        let availability = 'available';
        if (isCurrent) availability = 'sponsored';
        else if (isMember) availability = 'approved';
        else if (sponsor.status === 'PENDING') availability = 'pending';
        else if (sponsor.status === 'APPROVED') availability = 'approved';
        else if (sponsor.status === 'DENIED' && !Number(sponsor.cooldown_complete)) availability = 'cooldown';

        return {
          sponsorId: sponsor.sponsor_id,
          companyName: sponsor.company_name,
          availability,
          canApply: availability === 'available',
          applicationStatus: sponsor.status || null,
          appliedAt: sponsor.applied_at || null,
          decidedAt: sponsor.decided_at || null,
          canReapplyAt: sponsor.status === 'DENIED' ? sponsor.can_reapply_at : null,
        };
      }));
    } catch (error) {
      console.error('List sponsors for driver applications error:', error);
      return res.status(500).json({ message: 'Unable to load sponsors' });
    }
  });

  router.post('/', async (req, res) => {
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

      // Lock the driver row so concurrent submissions for this driver are checked in order.
      const [drivers] = await connection.query(
        'SELECT sponsor_id FROM Drivers WHERE user_id = ? FOR UPDATE',
        [req.userId]
      );
      if (drivers.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Driver account not found' });
      }

      const [sponsors] = await connection.query(
        'SELECT sponsor_id FROM Sponsors WHERE sponsor_id = ? LIMIT 1',
        [sponsorId]
      );
      if (sponsors.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Sponsor not found' });
      }

      if (Number(drivers[0].sponsor_id) === sponsorId) {
        await connection.rollback();
        return res.status(409).json({ message: 'You already belong to this sponsor' });
      }

      const [memberships] = await connection.query(
        'SELECT 1 FROM DriverSponsorships WHERE driver_id = ? AND sponsor_id = ? LIMIT 1',
        [req.userId, sponsorId]
      );
      if (memberships.length > 0) {
        await connection.rollback();
        return res.status(409).json({ message: 'You already belong to this sponsor' });
      }

      const [applications] = await connection.query(
        `SELECT status, decided_at,
                decided_at <= NOW() - INTERVAL 30 DAY AS cooldown_complete
         FROM DriverApplications
         WHERE driver_id = ? AND sponsor_id = ?
         ORDER BY applied_at DESC, application_id DESC LIMIT 1`,
        [req.userId, sponsorId]
      );
      const latest = applications[0];
      if (latest?.status === 'PENDING') {
        await connection.rollback();
        return res.status(409).json({ message: 'You already have a pending application for this sponsor' });
      }
      if (latest?.status === 'APPROVED') {
        await connection.rollback();
        return res.status(409).json({ message: 'You have already been approved by this sponsor' });
      }
      if (latest?.status === 'DENIED' && (!latest.decided_at || !Number(latest.cooldown_complete))) {
        await connection.rollback();
        return res.status(409).json({ message: 'You can reapply 30 days after your last denial' });
      }

      const [result] = await connection.query(
        'INSERT INTO DriverApplications (driver_id, sponsor_id) VALUES (?, ?)',
        [req.userId, sponsorId]
      );
      await connection.commit();
      return res.status(201).json({
        applicationId: result.insertId,
        sponsorId,
        status: 'PENDING',
        message: 'Application submitted',
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Submit driver application error:', error);
      return res.status(500).json({ message: 'Unable to submit application' });
    } finally {
      if (connection) connection.release();
    }
  });

  return router;
}

module.exports = { createDriverApplicationsRouter };
