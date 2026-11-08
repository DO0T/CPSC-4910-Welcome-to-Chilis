const express = require('express');

function createPostRemovalRouter(pool) {
  const router = express.Router();

  router.get('/sponsor/policy', async (req, res) => {
    if (req.userRole !== 'Sponsor') return res.status(403).json({ message: 'Sponsor access required' });
    try {
      const [rows] = await pool.query('SELECT s.post_removal_days FROM Sponsors s JOIN SponsorUsers su ON su.sponsor_id = s.sponsor_id WHERE su.user_id = ?', [req.userId]);
      if (!rows.length) return res.status(404).json({ message: 'Sponsor organization not found' });
      return res.json({ days: Number(rows[0].post_removal_days) });
    } catch (error) {
      console.error('Load point policy error:', error);
      return res.status(500).json({ message: 'Unable to load point policy' });
    }
  });

  router.put('/sponsor/policy', async (req, res) => {
    if (req.userRole !== 'Sponsor') return res.status(403).json({ message: 'Sponsor access required' });
    const days = req.body?.days;
    if (!Number.isSafeInteger(days) || days < 0 || days > 3650) return res.status(400).json({ message: 'Enter a whole number of days between 0 and 3650' });
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT s.sponsor_id, s.company_name, s.post_removal_days FROM Sponsors s JOIN SponsorUsers su ON su.sponsor_id = s.sponsor_id WHERE su.user_id = ? FOR UPDATE', [req.userId]);
      if (!rows.length) { await connection.rollback(); return res.status(404).json({ message: 'Sponsor organization not found' }); }
      const org = rows[0];
      if (Number(org.post_removal_days) !== days) {
        await connection.query('UPDATE Sponsors SET post_removal_days = ? WHERE sponsor_id = ?', [days, org.sponsor_id]);
        const message = days ? `${org.company_name} policy: drivers removed in the future may use points for ${days} days after removal.` : `${org.company_name} policy: drivers removed in the future cannot use points after removal.`;
        await connection.query("INSERT INTO UserAlerts (user_id, alert_type, message) SELECT driver_id, 'points', ? FROM DriverSponsorships WHERE sponsor_id = ?", [message, org.sponsor_id]);
      }
      await connection.commit();
      return res.json({ days, message: 'Point policy saved.' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Save point policy error:', error);
      return res.status(500).json({ message: 'Unable to save point policy' });
    } finally { if (connection) connection.release(); }
  });

  router.get('/driver/post-removal-access', async (req, res) => {
    if (req.userRole !== 'Driver') return res.status(403).json({ message: 'Driver access required' });
    try {
      const [rows] = await pool.query(`SELECT s.company_name, a.removed_at, a.expires_at,
        (a.expires_at IS NOT NULL AND a.expires_at > NOW()) AS permitted,
        COALESCE((SELECT SUM(p.point_change) FROM DriverPoints p WHERE p.driver_id = a.driver_id AND p.sponsor_id = a.sponsor_id), 0) AS points
        FROM DriverPostRemovalAccess a JOIN Sponsors s ON s.sponsor_id = a.sponsor_id
        WHERE a.driver_id = ? AND NOT EXISTS (SELECT 1 FROM DriverSponsorships ds WHERE ds.driver_id = a.driver_id AND ds.sponsor_id = a.sponsor_id)
        ORDER BY a.removed_at DESC`, [req.userId]);
      return res.json(rows.map(row => ({ companyName: row.company_name, removedAt: row.removed_at, expiresAt: row.expires_at, permitted: Boolean(row.permitted), points: Number(row.points) })));
    } catch (error) {
      console.error('Load post-removal access error:', error);
      return res.status(500).json({ message: 'Unable to load post-removal point access' });
    }
  });
  return router;
}
module.exports = { createPostRemovalRouter };
