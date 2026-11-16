const express = require("express");

function createAlertRouter(pool) {
  const router = express.Router();

  // Return the authenticated user's full alert history.
  router.get("/", async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT alert_id AS id, alert_type AS type, message, created_at, is_viewed " +
          "FROM UserAlerts WHERE user_id = ? " +
          "ORDER BY created_at DESC, alert_id DESC;",
        [req.userId]
      );
      return res.json(rows);
    } catch (error) {
      console.error("Fetch alerts error:", error);
      return res.status(500).json({ message: "Unable to load alerts." });
    }
  });

  // Mark only the alerts that were actually returned to this user as viewed.
  router.post('/viewed', async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000 ||
        ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return res.status(400).json({ message: 'Choose valid alerts.' });
    }
    try {
      await pool.query('UPDATE UserAlerts SET is_viewed = 1 WHERE user_id = ? AND alert_id IN (?)', [req.userId, ids]);
      return res.json({ message: 'Alerts marked as viewed.' });
    } catch (error) {
      console.error('Mark alerts viewed error:', error);
      return res.status(500).json({ message: 'Unable to mark alerts as viewed.' });
    }
  });

  return router;
}

module.exports = { createAlertRouter };
