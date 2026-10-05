const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

app.use(cors());
app.use(express.json());

const pool = mysql.createPool(
{
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function verifyDatabaseConnection() 
{ 
  try 
  {
    const connection = await pool.getConnection();
    console.log("Database connection successful");
    connection.release();
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
}

async function createAuditLog(
  username,
  eventCategory,
  status,
  details,
  db = pool
)
{
  const query = `
    INSERT INTO AuditLog
    (
      username,
      event_category,
      status,
      details
    )
    VALUES (?, ?, ?, ?);
  `;

  await db.query(query,
  [
    username,
    eventCategory,
    status,
    details
  ]);
}

async function logApplicationChange(
  driverId,
  sponsorId,
  status,
  reason,
  db = pool
)
{
  if (status !== "ACCEPTED" && status !== "REJECTED")
  {
    throw new Error("Application status must be ACCEPTED or REJECTED");
  }

  if (!reason)
  {
    throw new Error("A reason is required for an application decision");
  }

  await createAuditLog(
    null,
    "Driver Application",
    status,
    `Driver ID: ${driverId}; Sponsor ID: ${sponsorId}; Reason: ${reason}`,
    db
  );
}

app.get("/api/health", (req, res) => 
{
  res.json(
  {
    status: "ok",
    message: "Welcome to Chili's API is running",
  });
});

// In-memory sessions keep profile requests tied to the user who logged in.
// Restarting the server invalidates these development sessions.
const sessions = new Map();
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function requireLogin(req, res, next)
{
  const authorization = req.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const session = sessions.get(token);

  if (!session || session.expiresAt <= Date.now())
  {
    if (token) sessions.delete(token);
    return res.status(401).json({ message: "Please log in to continue" });
  }

  req.userId = session.userId;
  req.userRole = session.role;
  req.authToken = token;
  next();
}

function requireAdmin(req, res, next)
{
  if (req.userRole !== "Admin")
  {
    return res.status(403).json({
      message: "Admin access required"
    });
  }

  next();
}

function isValidPictureUrl(value)
{
  if (!value) return true;
  try
  {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  }
  catch
  {
    return false;
  }
}

// Create a Driver or Sponsor account. Email is the username used at login.
app.post("/api/signup", async (req, res) =>
{
  let connection;
  try
  {
    const { name, email, password, profilePictureUrl, role = "Driver", companyName } = req.body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanProfilePictureUrl = typeof profilePictureUrl === "string" ? profilePictureUrl.trim() : "";
    const cleanCompanyName = typeof companyName === "string" ? companyName.trim() : "";

    if (!cleanName || !cleanEmail || typeof password !== "string" || !password)
    {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Basic server-side email format check; the browser's type=email is not enough.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (role !== "Driver" && role !== "Sponsor")
    {
      return res.status(400).json({ message: "Please choose Driver or Sponsor" });
    }

    if (role === "Sponsor" && !cleanCompanyName)
    {
      return res.status(400).json({ message: "Company name is required for sponsor accounts" });
    }

    if (cleanProfilePictureUrl)
    {
      try
      {
        const pictureUrl = new URL(cleanProfilePictureUrl);
        if (!["http:", "https:"].includes(pictureUrl.protocol)) throw new Error("Invalid protocol");
      }
      catch
      {
        return res.status(400).json({ message: "Profile picture must be a valid HTTP or HTTPS URL" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO Users (name, username, password_hash, role, profile_picture_url) VALUES (?, ?, ?, ?, ?);",
      [cleanName, cleanEmail, passwordHash, role, cleanProfilePictureUrl || null]
    );

    if (role === "Sponsor")
    {
      const [sponsor] = await connection.query(
        "INSERT INTO Sponsors (company_name) VALUES (?);",
        [cleanCompanyName]
      );
      await connection.query(
        "INSERT INTO SponsorUsers (user_id, sponsor_id) VALUES (?, ?);",
        [result.insertId, sponsor.insertId]
      );
    }
    else
    {
      await connection.query(
        "INSERT INTO Drivers (user_id, total_points) VALUES (?, 0);",
        [result.insertId]
      );
    }

    await connection.commit();

    return res.status(201).json({
      message: "Account created successfully",
      id: result.insertId,
      name: cleanName,
      role,
      profilePictureUrl: cleanProfilePictureUrl || null
    });
  }
  catch (error)
  {
    if (connection) await connection.rollback();
    // Also handle duplicate usernames if two signup requests race.
    if (error.code === "ER_DUP_ENTRY")
    {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
  finally
  {
    if (connection) connection.release();
  }
});

app.get("/api/profile", requireLogin, async (req, res) =>
{
  try
  {
    const [rows] = await pool.query(
      "SELECT user_id, name, username, role, profile_picture_url FROM Users WHERE user_id = ? LIMIT 1;",
      [req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    return res.json({
      id: user.user_id,
      name: user.name,
      email: user.username,
      role: user.role,
      profilePictureUrl: user.profile_picture_url
    });
  }
  catch (error)
  {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/logout", requireLogin, (req, res) =>
{
  sessions.delete(req.authToken);
  return res.json({ message: "Logged out successfully" });
});

app.put("/api/profile", requireLogin, async (req, res) =>
{
  try
  {
    const { name, email, profilePictureUrl, currentPassword, newPassword } = req.body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanPictureUrl = typeof profilePictureUrl === "string" ? profilePictureUrl.trim() : "";

    if (!cleanName || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    {
      return res.status(400).json({ message: "A valid name and email are required" });
    }
    if (!isValidPictureUrl(cleanPictureUrl))
    {
      return res.status(400).json({ message: "Profile picture must be a valid HTTP or HTTPS URL" });
    }

    const [duplicates] = await pool.query(
      "SELECT user_id FROM Users WHERE username = ? AND user_id <> ? LIMIT 1;",
      [cleanEmail, req.userId]
    );
    if (duplicates.length > 0)
    {
      return res.status(409).json({ message: "That email is already in use" });
    }

    let passwordHash;
    if (newPassword)
    {
      if (typeof currentPassword !== "string" || !currentPassword)
      {
        return res.status(400).json({ message: "Enter your current password to change it" });
      }
      const [userRows] = await pool.query(
        "SELECT password_hash FROM Users WHERE user_id = ? LIMIT 1;",
        [req.userId]
      );
      if (userRows.length === 0) return res.status(404).json({ message: "User not found" });
      if (!(await bcrypt.compare(currentPassword, userRows[0].password_hash)))
      {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      passwordHash = await bcrypt.hash(newPassword, 12);
    }

    let connection;

try
{
  connection = await pool.getConnection();
  await connection.beginTransaction();

  if (passwordHash)
  {
    await connection.query(
      "UPDATE Users SET name = ?, username = ?, profile_picture_url = ?, password_hash = ? WHERE user_id = ?;",
      [cleanName, cleanEmail, cleanPictureUrl || null, passwordHash, req.userId]
    );

    await createAuditLog(
      cleanEmail,
      "Password Change",
      "Success",
      `User ID: ${req.userId}; Password changed through profile update`,
      connection
    );
  }
  else
  {
    await connection.query(
      "UPDATE Users SET name = ?, username = ?, profile_picture_url = ? WHERE user_id = ?;",
      [cleanName, cleanEmail, cleanPictureUrl || null, req.userId]
    );
  }

  await connection.commit();
}
catch (error)
{
  if (connection)
  {
    await connection.rollback();
  }

  throw error;
}
finally
{
  if (connection)
  {
    connection.release();
  }
}

    return res.json({
      message: "Profile updated successfully",
      profile: { name: cleanName, email: cleanEmail, profilePictureUrl: cleanPictureUrl || null }
    });
  }
  catch (error)
  {
    if (error.code === "ER_DUP_ENTRY")
    {
      return res.status(409).json({ message: "That email is already in use" });
    }
    console.error("Profile update error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

if (require.main === module) 
{
  verifyDatabaseConnection();

  app.listen(PORT, () => 
  {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

app.get("/api/about", async (req, res) => 
{
  try 
  {
    const query = "SELECT * FROM AboutPage ORDER BY CAST(SUBSTRING_INDEX(version_number, ' ', -1) AS UNSIGNED) DESC, id DESC;"; 
    const [rows] = await pool.query(query);
    res.json(rows);
  }
  catch (error) 
  {
    console.error("Error fetching about info:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/driver-points", async (req, res) =>
{
  try 
  {
    const query = `
      SELECT user_id AS driver_id, sponsor_id, total_points
      FROM Drivers;
      `;
    const [rows] = await pool.query(query);

    res.json(rows);
  } 
  catch (error) 
  {
    console.error("Error fetching driver points:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/driver-points", async (req, res) =>

{
  const { driver_id, sponsor_id, point_change, reason } = req.body;

  if (
    driver_id == null ||
    sponsor_id == null ||
    point_change == null ||
    !reason
  )
  {
    return res.status(400).json(
    {
      error: "driver_id, sponsor_id, point_change, and reason are required"
    });
  }

  let connection;

  try
  {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        UPDATE Drivers
        SET total_points = COALESCE(total_points, 0) + ?
        WHERE user_id = ? AND sponsor_id = ?;
      `,
      [point_change, driver_id, sponsor_id]
    );

    if (result.affectedRows === 0)
    {
      await connection.rollback();

      return res.status(404).json(
      {
        error: "Driver not found for the specified sponsor"
      });
    }

    await createAuditLog(
      null,
      "Point Change",
      "Success",
      `Driver ID: ${driver_id}; Sponsor ID: ${sponsor_id}; Points changed by ${point_change}; Reason: ${reason}`,
      connection
    );

    await connection.commit();

    const [rows] = await connection.query(
      `
        SELECT total_points
        FROM Drivers
        WHERE user_id = ?;
      `,
      [driver_id]
    );

    res.status(200).json(
    {
      message: "Driver points updated successfully",
      driver_id: driver_id,
      point_change: point_change,
      total_points: rows[0].total_points
    });
  }

  catch (error)
  {
    if (connection)
    {
      await connection.rollback();
    }

    console.error("Error updating driver points:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
  finally
  {
    if (connection)
    {
      connection.release();
    }
  }
});

app.get("/api/driver/points", requireLogin, async (req, res) => {
  try {
    const query = "SELECT total_points FROM Drivers WHERE user_id = ?;";
    const [rows] = await pool.query(query, [req.userId]);

    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.json({ total_points: rows[0].total_points });
    
  } catch (error) {
    console.error("Error fetching driver points:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Recent point-change history for the logged-in driver (feeds the dashboard's
// "recent activity" card). Reuses the existing DriverPoints ledger table —
// no schema changes. Scoped to req.userId so a driver only ever sees their own rows.
app.get("/api/driver/points-history", requireLogin, async (req, res) => {
  try {
    const query =
      "SELECT id, point_change, reason, transaction_date FROM DriverPoints " +
      "WHERE driver_id = ? ORDER BY transaction_date DESC LIMIT 20;";
    const [rows] = await pool.query(query, [req.userId]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching driver points history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Sponsor dashboard data comes only from the sponsor linked to this session.
// Driver applications are not included because the schema has no application records yet.
app.get("/api/sponsor/dashboard", requireLogin, async (req, res) => {
  try {
    const [accounts] = await pool.query(
      "SELECT u.role, s.sponsor_id, s.company_name " +
      "FROM Users u LEFT JOIN SponsorUsers su ON su.user_id = u.user_id " +
      "LEFT JOIN Sponsors s ON s.sponsor_id = su.sponsor_id " +
      "WHERE u.user_id = ? LIMIT 1;",
      [req.userId]
    );
    if (accounts.length === 0) return res.status(404).json({ message: "Account not found" });
    if (accounts[0].role !== "Sponsor") {
      return res.status(403).json({ message: "Sponsor access required" });
    }

    const { sponsor_id: sponsorId, company_name: companyName } = accounts[0];
    if (!sponsorId) {
      return res.status(404).json({ message: "No organization is linked to this sponsor account" });
    }

    const [driversResult, pointsResult, activityResult] = await Promise.allSettled([
      pool.query(
        "SELECT COUNT(*) AS sponsored_drivers FROM Drivers WHERE sponsor_id = ?;",
        [sponsorId]
      ),
      pool.query(
        "SELECT COALESCE(SUM(point_change), 0) AS points_awarded_this_month " +
        "FROM DriverPoints WHERE sponsor_id = ? AND point_change > 0 " +
        "AND transaction_date >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') " +
        "AND transaction_date < DATE_FORMAT(CURRENT_DATE() + INTERVAL 1 MONTH, '%Y-%m-01');",
        [sponsorId]
      ),
      pool.query(
        "SELECT dp.id, dp.driver_id, dp.transaction_date, u.name AS driver_name, " +
        "dp.reason, dp.point_change FROM DriverPoints dp " +
        "LEFT JOIN Users u ON u.user_id = dp.driver_id " +
        "WHERE dp.sponsor_id = ? ORDER BY dp.transaction_date DESC, dp.id DESC LIMIT 10;",
        [sponsorId]
      )
    ]);

    const unavailable = [];
    for (const [section, result] of [
      ["drivers", driversResult], ["points", pointsResult], ["activity", activityResult]
    ]) {
      if (result.status === "rejected") {
        console.error(`Sponsor dashboard ${section} query error:`, result.reason);
        unavailable.push(section);
      }
    }

    const activityRows = activityResult.status === "fulfilled" ? activityResult.value[0] : null;

    return res.json({
      companyName,
      sponsoredDrivers: driversResult.status === "fulfilled"
        ? Number(driversResult.value[0][0].sponsored_drivers) : null,
      pointsAwardedThisMonth: pointsResult.status === "fulfilled"
        ? Number(pointsResult.value[0][0].points_awarded_this_month) : null,
      recentActivity: activityRows?.map((row) => ({
        id: row.id,
        date: row.transaction_date,
        driver: row.driver_name || `Driver #${row.driver_id}`,
        reason: row.reason || "Point adjustment",
        points: row.point_change
      })) ?? null,
      unavailable
    });
  } catch (error) {
    console.error("Sponsor dashboard error:", error);
    if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") {
      return res.status(503).json({
        message: "Sponsor account data is not set up in the database yet. Ask your team to check the sponsor tables."
      });
    }
    return res.status(500).json({ message: "Unable to load the sponsor dashboard" });
  }
});

app.post("/api/login", async (req, res) =>
{
  try
  {
    const { username, password } = req.body;

    if (!username || !password)
    {
      return res.status(400).json(
      {
        message: "Username and password are required"
      });
    }

    const query = "SELECT * FROM Users WHERE username = ?;";
    const [rows] = await pool.query(query, [username]);

    if (rows.length === 0)
    {
      await createAuditLog(
        username,
        "Login Attempt",
        "Failure",
        "Invalid username or password"
      );

      return res.status(401).json(
      {
        message: "Invalid username or password"
      });
    }

    const userRecord = rows[0];

    const match = await bcrypt.compare(
      password,
      userRecord.password_hash
    );

    if (!match)
{
  await createAuditLog(
    username,
    "Login Attempt",
    "Failure",
    "Invalid username or password"
  );

  return res.status(401).json(
  {
    message: "Invalid username or password"
  });
}

await createAuditLog(
  username,
  "Login Attempt",
  "Success",
  "User logged in successfully"
);

const sessionToken = crypto.randomBytes(32).toString("hex");

sessions.set(sessionToken, {
  userId: userRecord.user_id,
  role: userRecord.role,
  expiresAt: Date.now() + SESSION_DURATION_MS
});

return res.status(200).json({
      message: "Login successful",
      token: sessionToken,
      role: userRecord.role,
      id: userRecord.user_id,
      name: userRecord.name,
      profilePictureUrl: userRecord.profile_picture_url
    });
  }
  catch (error)
  {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/audit-logs", requireLogin, requireAdmin, async (req, res) =>
{
  try
  {
    const query = "SELECT * FROM AuditLog ORDER BY event_date DESC;";
    const [rows] = await pool.query(query);

    res.json(rows);
  }
  catch (error)
  {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
