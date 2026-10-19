const express = require("express");

function createAlertRouter(pool) {
  const router = express.Router();

  // Return the authenticated user's full alert history.
  router.get("/", async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT alert_id AS id, alert_type AS type, message, created_at " +
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

  return router;
}

module.exports = { createAlertRouter };
