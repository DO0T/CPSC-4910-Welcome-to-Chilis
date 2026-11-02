const express = require('express');

function createPointDisputesRouter(pool) {
  const router = express.Router();
  const allowed = `(d.driver_id = ? AND ? = 'Driver') OR
    (? = 'Sponsor' AND EXISTS (SELECT 1 FROM SponsorUsers su WHERE su.user_id = ? AND su.sponsor_id = d.sponsor_id)) OR ? = 'Admin'`;
  const access = (req) => [req.userId, req.userRole, req.userRole, req.userId, req.userRole];
  const text = (value) => (typeof value === 'string' ? value.trim() : '');

  router.get('/removals', async (req, res) => {
    if (req.userRole !== 'Driver')
      return res.status(403).json({ message: 'Driver access required' });
    try {
      const [rows] = await pool.query(
        `SELECT p.id, p.point_change, p.reason, p.transaction_date, s.company_name
        FROM DriverPoints p JOIN Sponsors s ON s.sponsor_id = p.sponsor_id
        LEFT JOIN PointDisputes d ON d.point_id = p.id
        WHERE p.driver_id = ? AND p.point_change < 0 AND d.dispute_id IS NULL
        ORDER BY p.transaction_date DESC, p.id DESC`,
        [req.userId],
      );
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Unable to load point removals.' });
    }
  });

  router.get('/preferences', async (req, res) => {
    if (req.userRole !== 'Sponsor')
      return res.status(403).json({ message: 'Sponsor access required' });
    try {
      const [rows] = await pool.query(
        'SELECT driver_reply_enabled FROM DisputeNotificationPreferences WHERE user_id = ?',
        [req.userId],
      );
      res.json({ driverReplyEnabled: rows.length ? Boolean(rows[0].driver_reply_enabled) : true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Unable to load notification preference.' });
    }
  });
  router.put('/preferences', async (req, res) => {
    if (req.userRole !== 'Sponsor')
      return res.status(403).json({ message: 'Sponsor access required' });
    if (typeof req.body?.driverReplyEnabled !== 'boolean')
      return res.status(400).json({ message: 'A notification preference is required.' });
    try {
      await pool.query(
        'INSERT INTO DisputeNotificationPreferences (user_id, driver_reply_enabled) VALUES (?, ?) ON DUPLICATE KEY UPDATE driver_reply_enabled = VALUES(driver_reply_enabled)',
        [req.userId, req.body.driverReplyEnabled],
      );
      res.json({ driverReplyEnabled: req.body.driverReplyEnabled });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Unable to save notification preference.' });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT d.dispute_id, d.point_id, d.status, d.created_at, d.updated_at,
        p.point_change, p.reason, p.transaction_date, u.name AS driver_name,
        u.username AS driver_email, u.profile_picture_url AS driver_picture_url, s.company_name
        FROM PointDisputes d JOIN DriverPoints p ON p.id = d.point_id
        JOIN Users u ON u.user_id = d.driver_id JOIN Sponsors s ON s.sponsor_id = d.sponsor_id
        WHERE ${allowed} ORDER BY d.updated_at DESC, d.dispute_id DESC`,
        access(req),
      );
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Unable to load disputes.' });
    }
  });
  router.post('/', async (req, res) => {
    if (req.userRole !== 'Driver')
      return res.status(403).json({ message: 'Driver access required' });
    const pointId = Number(req.body?.pointId),
      message = text(req.body?.message);
    if (!Number.isSafeInteger(pointId) || pointId <= 0 || !message || message.length > 4000)
      return res
        .status(400)
        .json({ message: 'Select a removal and enter a message (up to 4000 characters).' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [points] = await connection.query(
        'SELECT id, sponsor_id FROM DriverPoints WHERE id = ? AND driver_id = ? AND point_change < 0 AND sponsor_id IS NOT NULL FOR UPDATE',
        [pointId, req.userId],
      );
      if (!points.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Point removal not found.' });
      }
      const [result] = await connection.query(
        'INSERT INTO PointDisputes (point_id, driver_id, sponsor_id) VALUES (?, ?, ?)',
        [pointId, req.userId, points[0].sponsor_id],
      );
      await connection.query(
        'INSERT INTO PointDisputeMessages (dispute_id, author_id, message) VALUES (?, ?, ?)',
        [result.insertId, req.userId, message],
      );
      await connection.query(
        "INSERT INTO UserAlerts (user_id, alert_type, message) SELECT user_id, 'dispute', ? FROM SponsorUsers WHERE sponsor_id = ?",
        [`A driver opened point dispute #${result.insertId}.`, points[0].sponsor_id],
      );
      await connection.commit();
      res.status(201).json({ disputeId: result.insertId });
    } catch (error) {
      if (connection) await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: 'This removal already has a dispute.' });
      console.error(error);
      res.status(500).json({ message: 'Unable to open dispute.' });
    } finally {
      if (connection) connection.release();
    }
  });

  router.get('/:id/messages', async (req, res) => {
    try {
      const [disputes] = await pool.query(
        `SELECT d.dispute_id FROM PointDisputes d WHERE d.dispute_id = ? AND (${allowed})`,
        [req.params.id, ...access(req)],
      );
      if (!disputes.length) return res.status(404).json({ message: 'Dispute not found.' });
      const [rows] = await pool.query(
        'SELECT m.message_id, m.message, m.created_at, u.name AS author_name FROM PointDisputeMessages m JOIN Users u ON u.user_id = m.author_id WHERE m.dispute_id = ? ORDER BY m.message_id',
        [req.params.id],
      );
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Unable to load messages.' });
    }
  });
  router.post('/:id/messages', async (req, res) => {
    if (!['Driver', 'Sponsor'].includes(req.userRole))
      return res.status(403).json({ message: 'Driver or sponsor access required.' });
    const message = text(req.body?.message);
    if (!message || message.length > 4000)
      return res.status(400).json({ message: 'Enter a message of up to 4000 characters.' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT d.* FROM PointDisputes d WHERE d.dispute_id = ? AND (${allowed}) FOR UPDATE`,
        [req.params.id, ...access(req)],
      );
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Dispute not found.' });
      }
      if (rows[0].status !== 'OPEN') {
        await connection.rollback();
        return res.status(409).json({ message: 'This dispute is closed.' });
      }
      await connection.query(
        'INSERT INTO PointDisputeMessages (dispute_id, author_id, message) VALUES (?, ?, ?)',
        [req.params.id, req.userId, message],
      );
      await connection.query(
        'UPDATE PointDisputes SET updated_at = CURRENT_TIMESTAMP WHERE dispute_id = ?',
        [req.params.id],
      );
      if (req.userRole === 'Driver')
        await connection.query(
          "INSERT INTO UserAlerts (user_id, alert_type, message) SELECT su.user_id, 'dispute', ? FROM SponsorUsers su LEFT JOIN DisputeNotificationPreferences p ON p.user_id = su.user_id WHERE su.sponsor_id = ? AND COALESCE(p.driver_reply_enabled, 1) = 1",
          [`A driver replied to point dispute #${req.params.id}.`, rows[0].sponsor_id],
        );
      else
        await connection.query(
          "INSERT INTO UserAlerts (user_id, alert_type, message) VALUES (?, 'dispute', ?)",
          [rows[0].driver_id, `Your sponsor replied to point dispute #${req.params.id}.`],
        );
      await connection.commit();
      res.status(201).json({ message: 'Message sent.' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error(error);
      res.status(500).json({ message: 'Unable to send message.' });
    } finally {
      if (connection) connection.release();
    }
  });
  router.patch('/:id/decision', async (req, res) => {
    if (req.userRole !== 'Sponsor')
      return res.status(403).json({ message: 'Sponsor access required.' });
    if (!['ACCEPTED', 'DENIED'].includes(req.body?.status))
      return res.status(400).json({ message: 'Choose accepted or denied.' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT d.* FROM PointDisputes d WHERE d.dispute_id = ? AND (${allowed}) FOR UPDATE`,
        [req.params.id, ...access(req)],
      );
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ message: 'Dispute not found.' });
      }
      if (rows[0].status !== 'OPEN') {
        await connection.rollback();
        return res.status(409).json({ message: 'This dispute is already closed.' });
      }
      let restoredPoints = 0;
      if (req.body.status === 'ACCEPTED') {
        const [points] = await connection.query(
          'SELECT point_change FROM DriverPoints WHERE id = ? AND driver_id = ? AND sponsor_id = ? FOR UPDATE',
          [rows[0].point_id, rows[0].driver_id, rows[0].sponsor_id],
        );
        if (
          !points.length ||
          !Number.isSafeInteger(Number(points[0].point_change)) ||
          Number(points[0].point_change) >= 0
        )
          throw new Error('The disputed point removal is invalid.');
        restoredPoints = -Number(points[0].point_change);
        const reason = `Restored after accepted dispute #${rows[0].dispute_id}`;
        const [updated] = await connection.query(
          'UPDATE Drivers SET total_points = COALESCE(total_points, 0) + ? WHERE user_id = ?',
          [restoredPoints, rows[0].driver_id],
        );
        if (updated.affectedRows !== 1) throw new Error('Driver account not found.');
        await connection.query(
          'INSERT INTO DriverPoints (driver_id, sponsor_id, point_change, reason) VALUES (?, ?, ?, ?)',
          [rows[0].driver_id, rows[0].sponsor_id, restoredPoints, reason],
        );
        await connection.query(
          "INSERT INTO AuditLog (username, event_category, status, details) SELECT username, 'Point Change', 'Success', ? FROM Users WHERE user_id = ?",
          [
            `Driver ID: ${rows[0].driver_id}; Sponsor ID: ${rows[0].sponsor_id}; Points changed by ${restoredPoints}; Reason: ${reason}`,
            rows[0].driver_id,
          ],
        );
      }
      await connection.query('UPDATE PointDisputes SET status = ? WHERE dispute_id = ?', [
        req.body.status,
        req.params.id,
      ]);
      await connection.query(
        "INSERT INTO UserAlerts (user_id, alert_type, message) VALUES (?, 'dispute', ?)",
        [
          rows[0].driver_id,
          `Point dispute #${req.params.id} was ${req.body.status.toLowerCase()}.${restoredPoints ? ` ${restoredPoints} points were restored.` : ''}`,
        ],
      );
      await connection.commit();
      res.json({ status: req.body.status, restoredPoints });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error(error);
      res.status(500).json({ message: 'Unable to update dispute.' });
    } finally {
      if (connection) connection.release();
    }
  });
  return router;
}
module.exports = { createPointDisputesRouter };
