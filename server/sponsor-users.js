const express = require("express");
const bcrypt = require("bcrypt");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the sponsor organization linked to a sponsor user, or null.
async function getSponsorOrgForUser(db, userId) {
  const [rows] = await db.query(
    `SELECT s.sponsor_id, s.company_name, s.point_value
     FROM SponsorUsers su
     JOIN Sponsors s ON s.sponsor_id = su.sponsor_id
     WHERE su.user_id = ?
     LIMIT 1;`,
    [userId]
  );
  return rows[0] || null;
}

// A driver belongs to a sponsor if they have a DriverSponsorships row for it,
// or if it is their currently active sponsor in the Drivers table.
async function driverBelongsToSponsor(db, driverId, sponsorId) {
  const [rows] = await db.query(
    `SELECT 1 AS found FROM DriverSponsorships WHERE driver_id = ? AND sponsor_id = ?
     UNION
     SELECT 1 AS found FROM Drivers WHERE user_id = ? AND sponsor_id = ?
     LIMIT 1;`,
    [driverId, sponsorId, driverId, sponsorId]
  );
  return rows.length > 0;
}

function createSponsorUsersRouter(pool, createAuditLog) {
  const router = express.Router();

  // Only sponsor sessions (including an admin who is viewing the site as a sponsor)
  // may use these routes. Attaches the sponsor's organization to req.sponsorOrg.
  async function requireSponsor(req, res, next) {
    if (req.userRole !== "Sponsor") {
      return res.status(403).json({ message: "Sponsor access required" });
    }
    try {
      const org = await getSponsorOrgForUser(pool, req.userId);
      if (!org) {
        return res
          .status(404)
          .json({ message: "No organization is linked to this sponsor account" });
      }
      req.sponsorOrg = org;
      next();
    } catch (error) {
      console.error("Sponsor lookup error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // ---------------------------------------------------------------
  // Sponsor info: review (GET) and update (PUT)
  // ---------------------------------------------------------------

  router.get("/me", requireSponsor, async (req, res) => {
    try {
      const sponsorId = req.sponsorOrg.sponsor_id;

      const [[userRows], [countRows], [teamRows]] = await Promise.all([
        pool.query(
          "SELECT user_id, name, username, profile_picture_url FROM Users WHERE user_id = ? LIMIT 1;",
          [req.userId]
        ),
        pool.query(
          `SELECT
             (SELECT COUNT(*) FROM SponsorUsers WHERE sponsor_id = ?) AS sponsor_user_count,
             (SELECT COUNT(*) FROM (
                SELECT user_id AS driver_id FROM Drivers WHERE sponsor_id = ?
                UNION
                SELECT driver_id FROM DriverSponsorships WHERE sponsor_id = ?
              ) AS org_drivers) AS driver_count;`,
          [sponsorId, sponsorId, sponsorId]
        ),
        pool.query(
          `SELECT u.user_id, u.name, u.username
           FROM SponsorUsers su
           JOIN Users u ON u.user_id = su.user_id
           WHERE su.sponsor_id = ?
           ORDER BY u.name ASC;`,
          [sponsorId]
        ),
      ]);

      const user = userRows[0];
      return res.json({
        user: user
          ? {
            id: user.user_id,
            name: user.name,
            email: user.username,
            profilePictureUrl: user.profile_picture_url,
          }
          : null,
        organization: {
          id: sponsorId,
          companyName: req.sponsorOrg.company_name,
          pointValue: Number(req.sponsorOrg.point_value),
          sponsorUserCount: Number(countRows[0]?.sponsor_user_count || 0),
          driverCount: Number(countRows[0]?.driver_count || 0),
        },
        teammates: teamRows.map((row) => ({
          id: row.user_id,
          name: row.name,
          email: row.username,
        })),
      });
    } catch (error) {
      console.error("Sponsor info fetch error:", error);
      return res.status(500).json({ message: "Unable to load sponsor info" });
    }
  });

  router.put("/organization", requireSponsor, async (req, res) => {
    try {
      const sponsorId = req.sponsorOrg.sponsor_id;
      const { companyName, pointValue } = req.body || {};

      const cleanCompany =
        typeof companyName === "string" && companyName.trim()
          ? companyName.trim()
          : req.sponsorOrg.company_name;
      const numericPointValue =
        pointValue === undefined || pointValue === null || pointValue === ""
          ? Number(req.sponsorOrg.point_value)
          : Number(pointValue);

      if (cleanCompany.length > 255) {
        return res.status(400).json({ message: "Company name is too long" });
      }
      if (!Number.isFinite(numericPointValue) || numericPointValue <= 0) {
        return res
          .status(400)
          .json({ message: "Point value must be a positive number" });
      }

      // Signup joins sponsors to an existing company by name, so names must stay unique.
      const [duplicates] = await pool.query(
        "SELECT sponsor_id FROM Sponsors WHERE LOWER(company_name) = LOWER(?) AND sponsor_id <> ? LIMIT 1;",
        [cleanCompany, sponsorId]
      );
      if (duplicates.length > 0) {
        return res
          .status(409)
          .json({ message: "Another organization already uses that name" });
      }

      await pool.query(
        "UPDATE Sponsors SET company_name = ?, point_value = ? WHERE sponsor_id = ?;",
        [cleanCompany, numericPointValue, sponsorId]
      );

      return res.json({
        message: "Sponsor info updated successfully",
        organization: {
          id: sponsorId,
          companyName: cleanCompany,
          pointValue: numericPointValue,
        },
      });
    } catch (error) {
      console.error("Sponsor info update error:", error);
      return res.status(500).json({ message: "Unable to update sponsor info" });
    }
  });

  // ---------------------------------------------------------------
  // Driver information: review list, review one driver, add a driver
  // ---------------------------------------------------------------

  router.get("/drivers", requireSponsor, async (req, res) => {
    try {
      const sponsorId = req.sponsorOrg.sponsor_id;
      const [rows] = await pool.query(
        `SELECT
           u.user_id,
           u.name,
           u.username,
           u.profile_picture_url,
           d.sponsor_id AS active_sponsor_id,
           COALESCE((SELECT SUM(p.point_change) FROM DriverPoints p
                     WHERE p.driver_id = u.user_id AND p.sponsor_id = ?), 0) AS points,
           (SELECT MAX(p.transaction_date) FROM DriverPoints p
            WHERE p.driver_id = u.user_id AND p.sponsor_id = ?) AS last_point_change
         FROM Users u
         JOIN Drivers d ON d.user_id = u.user_id
         WHERE u.role = 'Driver'
           AND (
             d.sponsor_id = ?
             OR EXISTS (SELECT 1 FROM DriverSponsorships ds
                        WHERE ds.driver_id = u.user_id AND ds.sponsor_id = ?)
           )
         ORDER BY u.name ASC;`,
        [sponsorId, sponsorId, sponsorId, sponsorId]
      );

      const pointValue = Number(req.sponsorOrg.point_value) || 0;
      return res.json(
        rows.map((row) => ({
          id: row.user_id,
          name: row.name,
          email: row.username,
          profilePictureUrl: row.profile_picture_url,
          points: Number(row.points),
          pointsDollarValue: Number((Number(row.points) * pointValue).toFixed(2)),
          isActiveSponsor: Number(row.active_sponsor_id) === Number(sponsorId),
          lastPointChange: row.last_point_change,
        }))
      );
    } catch (error) {
      console.error("Sponsor drivers fetch error:", error);
      return res.status(500).json({ message: "Unable to load drivers" });
    }
  });

  router.get("/drivers/:driverId", requireSponsor, async (req, res) => {
    try {
      const sponsorId = req.sponsorOrg.sponsor_id;
      const driverId = Number(req.params.driverId);
      if (!Number.isInteger(driverId) || driverId < 1) {
        return res.status(400).json({ message: "Invalid driver" });
      }

      if (!(await driverBelongsToSponsor(pool, driverId, sponsorId))) {
        return res
          .status(404)
          .json({ message: "Driver not found in your organization" });
      }

      const [[driverRows], [historyRows], [totalRows]] = await Promise.all([
        pool.query(
          `SELECT u.user_id, u.name, u.username, u.profile_picture_url, d.sponsor_id AS active_sponsor_id
           FROM Users u
           JOIN Drivers d ON d.user_id = u.user_id
           WHERE u.user_id = ? AND u.role = 'Driver'
           LIMIT 1;`,
          [driverId]
        ),
        pool.query(
          `SELECT id, point_change, reason, transaction_date
           FROM DriverPoints
           WHERE driver_id = ? AND sponsor_id = ?
           ORDER BY transaction_date DESC, id DESC
           LIMIT 50;`,
          [driverId, sponsorId]
        ),
        pool.query(
          "SELECT COALESCE(SUM(point_change), 0) AS total FROM DriverPoints WHERE driver_id = ? AND sponsor_id = ?;",
          [driverId, sponsorId]
        ),
      ]);

      if (driverRows.length === 0) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const driver = driverRows[0];
      const points = totalRows[0]?.total || 0;

      return res.json({
        id: driver.user_id,
        name: driver.name,
        email: driver.username,
        profilePictureUrl: driver.profile_picture_url,
        isActiveSponsor: Number(driver.active_sponsor_id) === Number(sponsorId),
        points: Number(points),
        pointHistory: historyRows.map((row) => ({
          id: row.id,
          pointChange: row.point_change,
          reason: row.reason,
          date: row.transaction_date,
        })),
      });
    } catch (error) {
      console.error("Sponsor driver detail error:", error);
      return res.status(500).json({ message: "Unable to load driver" });
    }
  });

  router.post("/drivers", requireSponsor, async (req, res) => {
    let connection;
    try {
      const sponsorId = req.sponsorOrg.sponsor_id;
      const { name, email, password } = req.body || {};
      const cleanName = typeof name === "string" ? name.trim() : "";
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

      if (!cleanName || !cleanEmail || typeof password !== "string" || !password) {
        return res
          .status(400)
          .json({ message: "Name, email, and a temporary password are required" });
      }
      if (!EMAIL_PATTERN.test(cleanEmail)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      if (password.length < 8) {
        return res
          .status(400)
          .json({ message: "Temporary password must be at least 8 characters" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [userInsert] = await connection.query(
        "INSERT INTO Users (name, username, password_hash, role) VALUES (?, ?, ?, 'Driver');",
        [cleanName, cleanEmail, passwordHash]
      );
      const driverId = userInsert.insertId;

      await connection.query(
        "INSERT INTO Drivers (user_id, sponsor_id, total_points) VALUES (?, ?, 0);",
        [driverId, sponsorId]
      );
      await connection.query(
        "INSERT INTO DriverSponsorships (driver_id, sponsor_id) VALUES (?, ?);",
        [driverId, sponsorId]
      );

      await createAuditLog(
        cleanEmail,
        "Driver Application",
        "ACCEPTED",
        `Driver ID: ${driverId}; Sponsor ID: ${sponsorId}; Reason: Driver account created by sponsor user ID ${req.userId}`,
        connection
      );

      await connection.commit();
      return res.status(201).json({
        message: `${cleanName} was added to ${req.sponsorOrg.company_name}`,
        driver: { id: driverId, name: cleanName, email: cleanEmail },
      });
    } catch (error) {
      if (connection) await connection.rollback();
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "An account with that email already exists. Existing drivers must apply to your organization.",
        });
      }
      console.error("Sponsor add driver error:", error);
      return res.status(500).json({ message: "Unable to add driver" });
    } finally {
      if (connection) connection.release();
    }
  });

  // ---------------------------------------------------------------
  // Assume a driver's identity / view the site as a driver
  // ---------------------------------------------------------------

  router.post("/impersonate", requireSponsor, async (req, res) => {
    try {
      const session = req.sessionData;
      const driverId = Number((req.body || {}).driverId);

      if (session.originalSponsorUserId) {
        return res
          .status(400)
          .json({ message: "Stop viewing as the current driver first" });
      }
      if (!Number.isInteger(driverId) || driverId < 1) {
        return res.status(400).json({ message: "Choose a driver to view as" });
      }

      const [rows] = await pool.query(
        "SELECT user_id, name, username, role FROM Users WHERE user_id = ? LIMIT 1;",
        [driverId]
      );
      if (rows.length === 0 || rows[0].role !== "Driver") {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (!(await driverBelongsToSponsor(pool, driverId, req.sponsorOrg.sponsor_id))) {
        return res
          .status(403)
          .json({ message: "You can only view as drivers in your organization" });
      }

      const driver = rows[0];
      session.originalSponsorUserId = session.userId;
      session.userId = driver.user_id;
      session.role = "Driver";
      session.sponsorImpersonating = {
        userId: driver.user_id,
        name: driver.name,
        email: driver.username,
        role: "Driver",
      };

      return res.json({
        message: `Now viewing site as ${driver.name} (Driver)`,
        role: "Driver",
        sponsorImpersonating: session.sponsorImpersonating,
      });
    } catch (error) {
      console.error("Sponsor impersonate error:", error);
      return res.status(500).json({ message: "Failed to switch to driver view" });
    }
  });

  // No requireSponsor here: while impersonating, the session role is "Driver".
  router.post("/stop-impersonating", (req, res) => {
    const session = req.sessionData;
    if (!session.originalSponsorUserId) {
      return res.status(400).json({ message: "You are not viewing as a driver" });
    }

    session.userId = session.originalSponsorUserId;
    session.role = "Sponsor";
    delete session.originalSponsorUserId;
    delete session.sponsorImpersonating;

    return res.json({ message: "Returned to Sponsor view", role: "Sponsor" });
  });

  return router;
}

module.exports = {
  createSponsorUsersRouter,
  getSponsorOrgForUser,
  driverBelongsToSponsor,
};