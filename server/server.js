const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer"); // Added for sending emails

app.use(cors());
app.use(express.json());

const pool = require("./db");
const { createSponsorCatalogRouter } = require('./sponsor-catalog');
const { createAlertRouter } = require('./alerts');

async function verifyDatabaseConnection() { 
  try {
    const connection = await pool.getConnection();
    console.log("Database connection successful");

    try 
    {
      await connection.query ("ALTER TABLE Users MODIFY COLUMN role ENUM('Driver', 'Sponsor', 'Admin', 'None') NOT NULL DEFAULT 'Driver';");
    } catch (migrationError) 
    {
      console.warn("Schema check note:", migrationError.message);
    }

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

// --- SESSION & TOKEN STORAGE ---
const sessions = new Map();
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

// In-memory store for reset tokens (Token -> { email, expiresAt })
const resetTokens = new Map();
const RESET_TOKEN_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Configure the email transporter using Mailtrap sandbox
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 2525,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function requireLogin(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const session = sessions.get(token);

  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ message: "Please log in to continue" });
  }

  req.userId = session.userId;
  req.userRole = session.role;
  req.authToken = token;
  req.sessionData = session;
  req.isAdmin = session.role === "Admin" || session.originalRole === "Admin";
  next();
}

function requireAdmin(req, res, next)
{
  if (!req.isAdmin)
  {
    return res.status(403).json({
      message: "Admin access required"
    });
  }

  next();
}

app.use('/api/sponsor/catalog', requireLogin, createSponsorCatalogRouter(pool));
app.use('/api/alerts', requireLogin, createAlertRouter(pool));

function isValidPictureUrl(value)
{
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

// Helper function to get current session & impersonation state
app.get("/api/session", requireLogin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, name, username, role, profile_picture_url FROM Users WHERE user_id = ? LIMIT 1;",
      [req.userId]
    );
    const activeUser = rows[0] || null;
    return res.json({
      userId: req.userId,
      role: req.userRole,
      isAdmin: req.isAdmin,
      impersonating: req.sessionData.impersonating || null,
      originalAdminId: req.sessionData.originalAdminId || null,
      user: activeUser
        ? {
            id: activeUser.user_id,
            name: activeUser.name,
            email: activeUser.username,
            role: activeUser.role,
            profilePictureUrl: activeUser.profile_picture_url,
          }
        : null,
    });
  } catch (error) {
    console.error("Session fetch error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/api/signup", async (req, res) => {
  let connection;
  try {
    const { name, email, password, profilePictureUrl, role = "Driver", companyName } = req.body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanProfilePictureUrl = typeof profilePictureUrl === "string" ? profilePictureUrl.trim() : "";
    const cleanCompanyName = typeof companyName === "string" ? companyName.trim() : "";

    if (!cleanName || !cleanEmail || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (role !== "Driver" && role !== "Sponsor") {
      return res.status(400).json({ message: "Please choose Driver or Sponsor" });
    }

    if (role === "Sponsor" && !cleanCompanyName) {
      return res.status(400).json({ message: "Company name is required for sponsor accounts" });
    }

    if (cleanProfilePictureUrl && !isValidPictureUrl(cleanProfilePictureUrl)) {
          return res
          .status(400)
          .json({ message: "Profile picture must be a valid HTTP or HTTPS URL" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const [result] = await connection.query(
      "INSERT INTO Users (name, username, password_hash, role, profile_picture_url) VALUES (?, ?, ?, ?, ?);",
      [cleanName, cleanEmail, passwordHash, role, cleanProfilePictureUrl || null]
    );

    if (role === "Sponsor") {
      // Reuse existing sponsor company if name matches, otherwise create new
      const [existingSponsors] = await connection.query(
        "SELECT sponsor_id FROM Sponsors WHERE LOWER(company_name) = LOWER(?) LIMIT 1;",
        [cleanCompanyName]
      );
      let sponsorId;
      if (existingSponsors.length > 0) {
        sponsorId = existingSponsors[0].sponsor_id;
      } else {
        const [sponsor] = await connection.query(
          "INSERT INTO Sponsors (company_name) VALUES (?);",
          [cleanCompanyName]
        );
        sponsorId = sponsor.insertId;
      }
      await connection.query(
        "INSERT INTO SponsorUsers (user_id, sponsor_id) VALUES (?, ?);",
        [result.insertId, sponsorId]
      );
    } else {
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
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (connection) connection.release();
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const {username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    const query = "SELECT * FROM Users WHERE username = ?;";
    const [rows] = await pool.query(query, [username]);

    if (rows.length === 0) {
      await createAuditLog(
        username,
        "Login Attempt",
        "Failure",
        "Invalid username or password"
      );
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const userRecord = rows[0];   
    const match = await bcrypt.compare(password, userRecord.password_hash);

    if (match) {
      if (!userRecord.role || userRecord.role === "None") {
        await createAuditLog(
          username,
          "Login Attempt",
          "Failure",
          "Account has no assigned role"
        );
        return res.status(403).json({
          message:
            "Your account currently has no active role assigned. Please contact an administrator.",
        });
      }

      await pool.query(
        "INSERT INTO AuditLog (username, event_category, status, details) VALUES (?, 'Login Attempt', 'Success', 'User logged in successfully');",
        [username]
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
    } else {
      await pool.query(
        "INSERT INTO AuditLog (username, event_category, status, details) VALUES (?, 'Login Attempt', 'Failure', 'Invalid username or password');",
        [username]
      );
      return res.status(401).json({ message: "Invalid username or password" });
    }
  } catch(error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/logout", requireLogin, (req, res) => {
  sessions.delete(req.authToken);
  return res.json({ message: "Logged out successfully" });
});

// Password Resetting

// Request Password Reset Link
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const [rows] = await pool.query(
      "SELECT user_id, name FROM Users WHERE username = ? LIMIT 1;",
      [cleanEmail]
    );

    if (rows.length > 0) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      resetTokens.set(resetToken, {
        email: cleanEmail,
        expiresAt: Date.now() + RESET_TOKEN_DURATION_MS,
      });

      const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetLink = `${frontendBase}/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: '"Good Driver Incentive Program" <support@gooddriverprogram.com>',
        to: cleanEmail,
        subject: "Password Reset Request",
        text: `Hello ${rows[0].name},\n\nA password reset was requested for your account. Please click the link below to set a new password:\n\n${resetLink}\n\nThis link will expire in 1 hour. If you did not request this, you can safely ignore this email.`,
      });
    }

    return res.status(200).json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// Submit new password function
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || typeof newPassword !== "string" || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    const tokenData = resetTokens.get(token);

    if (!tokenData || tokenData.expiresAt <= Date.now()) {
      if (tokenData) resetTokens.delete(token);
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query("UPDATE Users SET password_hash = ? WHERE username = ?;", [
      passwordHash,
      tokenData.email,
    ]);

    await pool.query(
      "INSERT INTO AuditLog (username, event_category, status, details) VALUES (?, 'Password Change', 'Success', 'Password reset via email token link');",
      [tokenData.email]
    );

    resetTokens.delete(token);

    return res.status(200).json({
      message: "Password has been successfully reset. You may now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
})

// --- PROFILE & DASHBOARD ROUTES ---

app.get("/api/profile", requireLogin, async (req, res) => {
  try {
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
      profilePictureUrl: user.profile_picture_url,
      isAdmin: req.isAdmin,
      impersonating: req.sessionData.impersonating || null,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/profile", requireLogin, async (req, res) => {
  try {
    const { name, email, profilePictureUrl, currentPassword, newPassword } = req.body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanPictureUrl = typeof profilePictureUrl === "string" ? profilePictureUrl.trim() : "";

    if (!cleanName || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "A valid name and email are required" });
    }
    if (!isValidPictureUrl(cleanPictureUrl)) {
      return res.status(400).json({ message: "Profile picture must be a valid HTTP or HTTPS URL" });
    }

    const [duplicates] = await pool.query(
      "SELECT user_id FROM Users WHERE username = ? AND user_id <> ? LIMIT 1;",
      [cleanEmail, req.userId]
    );
    if (duplicates.length > 0) {
      return res.status(409).json({ message: "That email is already in use" });
    }

    let passwordHash;
    if (newPassword) {
      // Allow an impersonating Admin to change the password without knowing the old one,
      // or require currentPassword for standard self-updates.
      if (!req.isAdmin) {
        if (typeof currentPassword !== "string" || !currentPassword) {
          return res
            .status(400)
            .json({ message: "Enter your current password to change it" });
        }
        const [userRows] = await pool.query(
          "SELECT password_hash FROM Users WHERE user_id = ? LIMIT 1;",
          [req.userId]
        );
        if (userRows.length === 0)
          return res.status(404).json({ message: "User not found" });
        if (!(await bcrypt.compare(currentPassword, userRows[0].password_hash))) {
          return res
            .status(401)
            .json({ message: "Current password is incorrect" });
        }
      }
      passwordHash = await bcrypt.hash(newPassword, 12);
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      if (passwordHash) {
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
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "That email is already in use" });
    }
    console.error("Profile update error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/about", async (req, res) => {
  try {
    const query = "SELECT * FROM AboutPage ORDER BY CAST(SUBSTRING_INDEX(version_number, ' ', -1) AS UNSIGNED) DESC, id DESC;"; 
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching about info:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/driver-points", async (req, res) =>
{
  try {
    const query = `
      SELECT d.user_id AS driver_id, u.name AS driver_name, u.username AS driver_email,
             d.sponsor_id, s.company_name, d.total_points
      FROM Drivers d
      JOIN Users u ON u.user_id = d.user_id
      LEFT JOIN Sponsors s ON s.sponsor_id = d.sponsor_id;
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching driver points:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/driver-points", requireLogin, async (req, res) => {
  const { driver_id, sponsor_id, point_change, reason } = req.body;
  const numericChange = Number(point_change);

  if (
    driver_id == null ||
    !Number.isFinite(numericChange) ||
    numericChange === 0 ||
    !reason ||
    !String(reason).trim()
  ) {
    return res.status(400).json({
      error: "driver_id, a non-zero point_change, and reason are required",
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Look up driver's current sponsor if sponsor_id was not explicitly passed
    const [driverRows] = await connection.query(
      "SELECT d.user_id, d.sponsor_id, d.total_points, u.username FROM Drivers d JOIN Users u ON u.user_id = d.user_id WHERE d.user_id = ? LIMIT 1;",
      [driver_id]
    );

    if (driverRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Driver not found" });
    }

    const effectiveSponsorId =
      sponsor_id != null ? sponsor_id : driverRows[0].sponsor_id;

    if (!req.isAdmin && driverRows[0].sponsor_id !== Number(effectiveSponsorId)) {
      await connection.rollback();
      return res.status(403).json({
        error: "Driver does not belong to the specified sponsor organization",
      });
    }

    await connection.query(
      `
        UPDATE Drivers
        SET total_points = COALESCE(total_points, 0) + ?
        WHERE user_id = ?;
      `,
      [numericChange, driver_id]
    );

    // Insert into DriverPoints ledger so Driver and Sponsor dashboards show recent activity
    await connection.query(
      `
        INSERT INTO DriverPoints (driver_id, sponsor_id, point_change, reason)
        VALUES (?, ?, ?, ?);
      `,
      [driver_id, effectiveSponsorId || null, numericChange, String(reason).trim()]
    );

  const pointsAlertMessage = numericChange > 0
    ? "You gained " + numericChange + " points: " + String(reason).trim()
    : "You lost " + Math.abs(numericChange) + " points: " + String(reason).trim();
  await connection.query(
    "INSERT INTO UserAlerts (user_id, alert_type, message) VALUES (?, 'points', ?);",
    [Number(driver_id), pointsAlertMessage]
  );

    await createAuditLog(
      driverRows[0].username,
      "Point Change",
      "Success",
      `Driver ID: ${driver_id}; Sponsor ID: ${
        effectiveSponsorId || "Admin"
      }; Points changed by ${numericChange}; Reason: ${String(reason).trim()}`,
      connection
    );

    await connection.commit();

    const [rows] = await connection.query(
      "SELECT total_points FROM Drivers WHERE user_id = ?;",
      [driver_id]
    );

    res.status(200).json({
      message: "Driver points updated successfully",
      driver_id,
      point_change: numericChange,
      total_points: rows[0].total_points,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating driver points:", error);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (connection) connection.release();
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

// Recent point change history for the logged-in driver (feeds the dashboard's
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
    if (accounts.length === 0)
      return res.status(404).json({ message: "Account not found" });
    if (accounts[0].role !== "Sponsor" && !req.isAdmin) {
      return res.status(403).json({ message: "Sponsor access required" });
    }

    let { sponsor_id: sponsorId, company_name: companyName } = accounts[0];

    // If an Admin navigates to /sponsor-dashboard directly without selecting a specific Sponsor user,
    // default to the first Sponsor organization so they can still preview it.
    if (!sponsorId && req.isAdmin) {
      const [firstSponsor] = await pool.query(
        "SELECT sponsor_id, company_name FROM Sponsors ORDER BY sponsor_id ASC LIMIT 1;"
      );
      if (firstSponsor.length > 0) {
        sponsorId = firstSponsor[0].sponsor_id;
        companyName = `${firstSponsor[0].company_name} (Admin Preview)`;
      }
    }

    if (!sponsorId) {
      return res
        .status(404)
        .json({ message: "No organization is linked to this sponsor account" });
    }

    const [driversResult, pointsResult, activityResult] =
      await Promise.allSettled([
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
        ),
      ]);

    const unavailable = [];
    for (const [section, result] of [
      ["drivers", driversResult],
      ["points", pointsResult],
      ["activity", activityResult],
    ]) {
      if (result.status === "rejected") {
        console.error(
          `Sponsor dashboard ${section} query error:`,
          result.reason
        );
        unavailable.push(section);
      }
    }

    const activityRows =
      activityResult.status === "fulfilled" ? activityResult.value[0] : null;

    return res.json({
      sponsorId,
      companyName,
      sponsoredDrivers:
        driversResult.status === "fulfilled"
          ? Number(driversResult.value[0][0].sponsored_drivers)
          : null,
      pointsAwardedThisMonth:
        pointsResult.status === "fulfilled"
          ? Number(pointsResult.value[0][0].points_awarded_this_month)
          : null,
      recentActivity:
        activityRows?.map((row) => ({
          id: row.id,
          date: row.transaction_date,
          driver: row.driver_name || `Driver #${row.driver_id}`,
          reason: row.reason || "Point adjustment",
          points: row.point_change,
        })) ?? null,
      unavailable,
    });
  } catch (error) {
    console.error("Sponsor dashboard error:", error);
    if (
      error.code === "ER_NO_SUCH_TABLE" ||
      error.code === "ER_BAD_FIELD_ERROR"
    ) {
      return res.status(503).json({
        message:
          "Sponsor account data is not set up in the database yet. Ask your team to check the sponsor tables.",
      });
    }
    return res
      .status(500)
      .json({ message: "Unable to load the sponsor dashboard" });
  }
});

// Get all users with their role, sponsor organization affiliation, and driver points
app.get("/api/admin/users", requireLogin, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        u.user_id,
        u.name,
        u.username AS email,
        u.role,
        u.profile_picture_url AS profilePictureUrl,
        su.sponsor_id AS sponsorUserSponsorId,
        sp_user.company_name AS sponsorOrganization,
        d.sponsor_id AS driverSponsorId,
        sp_driver.company_name AS driverSponsorOrganization,
        COALESCE(d.total_points, 0) AS totalPoints
      FROM Users u
      LEFT JOIN SponsorUsers su ON su.user_id = u.user_id
      LEFT JOIN Sponsors sp_user ON sp_user.sponsor_id = su.sponsor_id
      LEFT JOIN Drivers d ON d.user_id = u.user_id
      LEFT JOIN Sponsors sp_driver ON sp_driver.sponsor_id = d.sponsor_id
      ORDER BY u.user_id ASC;
    `;
    const [rows] = await pool.query(query);

    const formattedUsers = rows.map((row) => ({
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      profilePictureUrl: row.profilePictureUrl,
      sponsorId:
        row.role === "Sponsor"
          ? row.sponsorUserSponsorId
          : row.role === "Driver"
          ? row.driverSponsorId
          : null,
      affiliatedOrganization:
        row.role === "Sponsor"
          ? row.sponsorOrganization || "Unassigned"
          : row.role === "Driver"
          ? row.driverSponsorOrganization || "Unassigned"
          : null,
      totalPoints: row.role === "Driver" ? Number(row.totalPoints) : null,
    }));

    return res.json(formattedUsers);
  } catch (error) {
    console.error("Admin fetch users error:", error);
    return res.status(500).json({ message: "Failed to load users" });
  }
});

// Get all Sponsor Organizations (with user and driver counts)
app.get("/api/admin/sponsors", requireLogin, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.sponsor_id AS id,
        s.company_name AS companyName,
        s.point_value AS pointValue,
        COUNT(DISTINCT su.user_id) AS sponsorUserCount,
        COUNT(DISTINCT d.user_id) AS driverCount
      FROM Sponsors s
      LEFT JOIN SponsorUsers su ON su.sponsor_id = s.sponsor_id
      LEFT JOIN Drivers d ON d.sponsor_id = s.sponsor_id
      GROUP BY s.sponsor_id, s.company_name, s.point_value
      ORDER BY s.company_name ASC;
    `;
    const [rows] = await pool.query(query);
    return res.json(rows);
  } catch (error) {
    console.error("Admin fetch sponsors error:", error);
    return res
      .status(500)
      .json({ message: "Failed to load sponsor organizations" });
  }
});

//Create a new Sponsor Organization
app.post("/api/admin/sponsors", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { companyName, pointValue = 0.01 } = req.body || {};
    const cleanCompany =
      typeof companyName === "string" ? companyName.trim() : "";
    const numericPointValue = Number(pointValue);

    if (!cleanCompany) {
      return res.status(400).json({ message: "Company name is required" });
    }
    if (!Number.isFinite(numericPointValue) || numericPointValue <= 0) {
      return res
        .status(400)
        .json({ message: "Point value must be a positive number" });
    }

    const [result] = await pool.query(
      "INSERT INTO Sponsors (company_name, point_value) VALUES (?, ?);",
      [cleanCompany, numericPointValue]
    );

    return res.status(201).json({
      message: "Sponsor organization created successfully",
      sponsor: {
        id: result.insertId,
        companyName: cleanCompany,
        pointValue: numericPointValue,
      },
    });
  } catch (error) {
    console.error("Create sponsor error:", error);
    return res
      .status(500)
      .json({ message: "Failed to create sponsor organization" });
  }
});

// Update a Sponsor Organization (company name or point value)
app.put(
  "/api/admin/sponsors/:sponsorId",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    try {
      const sponsorId = Number(req.params.sponsorId);
      const { companyName, pointValue } = req.body || {};
      const cleanCompany =
        typeof companyName === "string" ? companyName.trim() : "";
      const numericPointValue = Number(pointValue);

      if (!cleanCompany || !Number.isFinite(numericPointValue) || numericPointValue <= 0) {
        return res.status(400).json({
          message: "Valid company name and positive point value are required",
        });
      }

      await pool.query(
        "UPDATE Sponsors SET company_name = ?, point_value = ? WHERE sponsor_id = ?;",
        [cleanCompany, numericPointValue, sponsorId]
      );

      return res.json({ message: "Sponsor organization updated successfully" });
    } catch (error) {
      console.error("Update sponsor error:", error);
      return res
        .status(500)
        .json({ message: "Failed to update sponsor organization" });
    }
  }
);

//Create a new User (Driver, Sponsor, or Admin) from the Admin Panel
app.post("/api/admin/users", requireLogin, requireAdmin, async (req, res) => {
  let connection;
  try {
    const {
      name,
      email,
      password,
      role = "Driver",
      sponsorId,
      newCompanyName,
      profilePictureUrl,
    } = req.body || {};

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanPic =
      typeof profilePictureUrl === "string" ? profilePictureUrl.trim() : "";
    const cleanCompany =
      typeof newCompanyName === "string" ? newCompanyName.trim() : "";

    if (!cleanName || !cleanEmail || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }
    if (!["Driver", "Sponsor", "Admin"].includes(role)) {
      return res
        .status(400)
        .json({ message: "Role must be Driver, Sponsor, or Admin" });
    }
    if (cleanPic && !isValidPictureUrl(cleanPic)) {
      return res
        .status(400)
        .json({ message: "Profile picture must be a valid HTTP/HTTPS URL" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [userInsert] = await connection.query(
      "INSERT INTO Users (name, username, password_hash, role, profile_picture_url) VALUES (?, ?, ?, ?, ?);",
      [cleanName, cleanEmail, passwordHash, role, cleanPic || null]
    );
    const newUserId = userInsert.insertId;

    let resolvedSponsorId = sponsorId ? Number(sponsorId) : null;
    if (role === "Sponsor" && !resolvedSponsorId && cleanCompany) {
      const [spInsert] = await connection.query(
        "INSERT INTO Sponsors (company_name) VALUES (?);",
        [cleanCompany]
      );
      resolvedSponsorId = spInsert.insertId;
    }

    if (role === "Sponsor") {
      if (!resolvedSponsorId) {
        await connection.rollback();
        return res.status(400).json({
          message:
            "Please select an existing Sponsor Organization or provide a new company name",
        });
      }
      await connection.query(
        "INSERT INTO SponsorUsers (user_id, sponsor_id) VALUES (?, ?);",
        [newUserId, resolvedSponsorId]
      );
    } else if (role === "Driver") {
      await connection.query(
        "INSERT INTO Drivers (user_id, sponsor_id, total_points) VALUES (?, ?, 0);",
        [newUserId, resolvedSponsorId || null]
      );
    }

    await connection.commit();
    return res.status(201).json({
      message: `${role} user created successfully`,
      userId: newUserId,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "An account with that email already exists" });
    }
    console.error("Admin create user error:", error);
    return res.status(500).json({ message: "Failed to create user" });
  } finally {
    if (connection) connection.release();
  }
});

// Update a User Account (Edit Role, Take Away Role, Update Info, Reset Password/Picture, Change Sponsor Affiliation)
app.put(
  "/api/admin/users/:userId",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    let connection;
    try {
      const targetUserId = Number(req.params.userId);
      const {
        name,
        email,
        role,
        profilePictureUrl,
        newPassword,
        sponsorId,
      } = req.body || {};

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [existingRows] = await connection.query(
        "SELECT * FROM Users WHERE user_id = ? LIMIT 1;",
        [targetUserId]
      );
      if (existingRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "User not found" });
      }
      const existingUser = existingRows[0];

      const cleanName =
        typeof name === "string" && name.trim()
          ? name.trim()
          : existingUser.name;
      const cleanEmail =
        typeof email === "string" && email.trim()
          ? email.trim().toLowerCase()
          : existingUser.username;
      const nextRole = role || existingUser.role;
      const cleanPictureUrl =
        profilePictureUrl === "" || profilePictureUrl === null
          ? null
          : typeof profilePictureUrl === "string"
          ? profilePictureUrl.trim()
          : existingUser.profile_picture_url;

      if (!["Driver", "Sponsor", "Admin", "None"].includes(nextRole)) {
        await connection.rollback();
        return res.status(400).json({ message: "Invalid role specified" });
      }

      if (cleanPictureUrl && !isValidPictureUrl(cleanPictureUrl)) {
        await connection.rollback();
        return res
          .status(400)
          .json({ message: "Profile picture must be a valid HTTP or HTTPS URL" });
      }

      // Check for duplicate email
      const [dup] = await connection.query(
        "SELECT user_id FROM Users WHERE username = ? AND user_id <> ? LIMIT 1;",
        [cleanEmail, targetUserId]
      );
      if (dup.length > 0) {
        await connection.rollback();
        return res.status(409).json({ message: "Email is already in use" });
      }

      // Update Users row (with optional password reset by Admin)
      if (typeof newPassword === "string" && newPassword.trim() !== "") {
        const passwordHash = await bcrypt.hash(newPassword.trim(), 12);
        await connection.query(
          "UPDATE Users SET name = ?, username = ?, role = ?, profile_picture_url = ?, password_hash = ? WHERE user_id = ?;",
          [
            cleanName,
            cleanEmail,
            nextRole,
            cleanPictureUrl,
            passwordHash,
            targetUserId,
          ]
        );
        await createAuditLog(
          cleanEmail,
          "Password Change",
          "Success",
          `Admin (ID: ${
            req.sessionData.originalAdminId || req.userId
          }) reset password for User ID: ${targetUserId}`,
          connection
        );
      } else {
        await connection.query(
          "UPDATE Users SET name = ?, username = ?, role = ?, profile_picture_url = ? WHERE user_id = ?;",
          [cleanName, cleanEmail, nextRole, cleanPictureUrl, targetUserId]
        );
      }

      // Synchronize role tables (Drivers & SponsorUsers)
      const parsedSponsorId =
        sponsorId === "" || sponsorId === null || sponsorId === undefined
          ? null
          : Number(sponsorId);

      if (nextRole === "Driver") {
        await connection.query("DELETE FROM SponsorUsers WHERE user_id = ?;", [
          targetUserId,
        ]);
        await connection.query(
          `
            INSERT INTO Drivers (user_id, sponsor_id, total_points)
            VALUES (?, ?, 0)
            ON DUPLICATE KEY UPDATE sponsor_id = VALUES(sponsor_id);
          `,
          [targetUserId, parsedSponsorId]
        );
      } else if (nextRole === "Sponsor") {
        await connection.query("DELETE FROM Drivers WHERE user_id = ?;", [
          targetUserId,
        ]);
        if (parsedSponsorId) {
          await connection.query(
            `
              INSERT INTO SponsorUsers (user_id, sponsor_id)
              VALUES (?, ?)
              ON DUPLICATE KEY UPDATE sponsor_id = VALUES(sponsor_id);
            `,
            [targetUserId, parsedSponsorId]
          );
        } else {
          await connection.query("DELETE FROM SponsorUsers WHERE user_id = ?;", [
            targetUserId,
          ]);
        }
      } else if (nextRole === "Admin" || nextRole === "None") {
        await connection.query("DELETE FROM SponsorUsers WHERE user_id = ?;", [
          targetUserId,
        ]);
        await connection.query("DELETE FROM Drivers WHERE user_id = ?;", [
          targetUserId,
        ]);
      }

      // Update or clear any active sessions belonging to this user
      for (const [tokenKey, sess] of sessions.entries()) {
        if (sess.userId === targetUserId && !sess.originalAdminId) {
          if (nextRole === "None") {
            sessions.delete(tokenKey);
          } else {
            sess.role = nextRole;
          }
        }
      }

      await connection.commit();
      return res.json({
        message: `User account for ${cleanName} updated successfully`,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Admin update user error:", error);
      return res.status(500).json({ message: "Failed to update user account" });
    } finally {
      if (connection) connection.release();
    }
  }
);

//Take Away Role (Dedicated Endpoint)
app.delete(
  "/api/admin/users/:userId/role",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    let connection;
    try {
      const targetUserId = Number(req.params.userId);
      const adminActorId = req.sessionData.originalAdminId || req.userId;

      if (targetUserId === adminActorId) {
        return res
          .status(400)
          .json({ message: "You cannot remove your own Admin role" });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [userRows] = await connection.query(
        "SELECT user_id, name, username, role FROM Users WHERE user_id = ? LIMIT 1;",
        [targetUserId]
      );
      if (userRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "User not found" });
      }

      const targetUser = userRows[0];

      await connection.query("DELETE FROM SponsorUsers WHERE user_id = ?;", [
        targetUserId,
      ]);
      await connection.query("DELETE FROM Drivers WHERE user_id = ?;", [
        targetUserId,
      ]);
      await connection.query("UPDATE Users SET role = 'None' WHERE user_id = ?;", [
        targetUserId,
      ]);

      // Invalidate active sessions for the user whose role was removed
      for (const [tokenKey, sess] of sessions.entries()) {
        if (sess.userId === targetUserId && !sess.originalAdminId) {
          sessions.delete(tokenKey);
        }
      }

      await connection.commit();
      return res.json({
        message: `Removed ${targetUser.role} role from ${targetUser.name}.`,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Admin remove role error:", error);
      return res.status(500).json({ message: "Failed to remove user role" });
    } finally {
      if (connection) connection.release();
    }
  }
);

// Drop a Driver from a Sponsor (with Mandatory Automated Email Alert & Audit Log)
app.post(
  "/api/admin/drivers/:driverId/drop",
  requireLogin,
  async (req, res) => {
    let connection;
    try {
      const driverId = Number(req.params.driverId);
      const { reason = "Dropped by Administrator" } = req.body || {};

      // Allow Admins or Sponsors to drop a driver
      if (!req.isAdmin && req.userRole !== "Sponsor") {
        return res
          .status(403)
          .json({ message: "Sponsor or Admin access required" });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
          SELECT d.user_id, d.sponsor_id, u.name, u.username AS email, s.company_name
          FROM Drivers d
          JOIN Users u ON u.user_id = d.user_id
          LEFT JOIN Sponsors s ON s.sponsor_id = d.sponsor_id
          WHERE d.user_id = ? LIMIT 1;
        `,
        [driverId]
      );

      if (rows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Driver not found" });
      }

      const driver = rows[0];
      const previousSponsorId = driver.sponsor_id;
      const previousCompany = driver.company_name || "Sponsor Organization";

      await connection.query(
        "UPDATE Drivers SET sponsor_id = NULL WHERE user_id = ?;",
        [driverId]
      );

      await createAuditLog(
        driver.email,
        "Driver Application",
        "REJECTED",
        `Driver ID: ${driverId} dropped from Sponsor ID: ${
          previousSponsorId || "N/A"
        } (${previousCompany}); Reason: ${reason}`,
        connection
      );

      await connection.commit();

      // Send mandatory automated alert email (cannot be disabled per PDF spec)
      try {
        await transporter.sendMail({
          from: '"Good Driver Incentive Program" <alerts@gooddriverprogram.com>',
          to: driver.email,
          subject: "Important Account Alert: Sponsor Affiliation Ended",
          text: `Hello ${driver.name},\n\nYou have been dropped from ${previousCompany}.\nReason: ${reason}\n\nNote: This is a mandatory system alert and cannot be disabled.`,
        });
      } catch (emailErr) {
        console.warn(
          "Driver dropped in DB, but alert email could not be sent:",
          emailErr.message
        );
      }

      return res.json({
        message: `${driver.name} has been dropped from ${previousCompany} and notified.`,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Drop driver error:", error);
      return res.status(500).json({ message: "Failed to drop driver" });
    } finally {
      if (connection) connection.release();
    }
  }
);

 // Assign a Driver to a Sponsor Organization
app.post(
  "/api/admin/drivers/:driverId/assign",
  requireLogin,
  async (req, res) => {
    let connection;
    try {
      const driverId = Number(req.params.driverId);
      const { sponsorId, reason = "Assigned by Administrator" } = req.body || {};

      if (!req.isAdmin && req.userRole !== "Sponsor") {
        return res
          .status(403)
          .json({ message: "Sponsor or Admin access required" });
      }
      if (!sponsorId) {
        return res
          .status(400)
          .json({ message: "A Sponsor Organization must be selected" });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [driverRows] = await connection.query(
        "SELECT u.user_id, u.name, u.username FROM Users u WHERE u.user_id = ? AND u.role = 'Driver' LIMIT 1;",
        [driverId]
      );
      if (driverRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Driver user not found" });
      }

      await connection.query(
        `
          INSERT INTO Drivers (user_id, sponsor_id, total_points)
          VALUES (?, ?, 0)
          ON DUPLICATE KEY UPDATE sponsor_id = VALUES(sponsor_id);
        `,
        [driverId, Number(sponsorId)]
      );

      await createAuditLog(
        driverRows[0].username,
        "Driver Application",
        "ACCEPTED",
        `Driver ID: ${driverId}; Sponsor ID: ${sponsorId}; Reason: ${reason}`,
        connection
      );

      await connection.commit();
      return res.json({
        message: `${driverRows[0].name} assigned to Sponsor successfully.`,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Assign driver error:", error);
      return res
        .status(500)
        .json({ message: "Failed to assign driver to sponsor" });
    } finally {
      if (connection) connection.release();
    }
  }
);

 // Assume Identity / View Site As a Standard Driver or Sponsor User
app.post(
  "/api/admin/impersonate",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    try {
      const { targetUserId, targetRole } = req.body || {};
      let targetUser = null;

      if (targetUserId) {
        const [rows] = await pool.query(
          "SELECT user_id, name, username, role FROM Users WHERE user_id = ? LIMIT 1;",
          [Number(targetUserId)]
        );
        if (rows.length === 0) {
          return res.status(404).json({ message: "Target user not found" });
        }
        targetUser = rows[0];
      } else if (targetRole === "Driver" || targetRole === "Sponsor") {
        // If Admin clicks quick "View as Standard Driver" or "View as Standard Sponsor",
        // pick the first available user of that role so all dashboard queries have valid data.
        const [rows] = await pool.query(
          "SELECT user_id, name, username, role FROM Users WHERE role = ? ORDER BY user_id ASC LIMIT 1;",
          [targetRole]
        );
        if (rows.length === 0) {
          return res.status(404).json({
            message: `No ${targetRole} accounts exist yet. Create one first to preview as a ${targetRole}.`,
          });
        }
        targetUser = rows[0];
      } else {
        return res
          .status(400)
          .json({ message: "Specify a targetUserId or targetRole" });
      }

      if (targetUser.role === "None") {
        return res.status(400).json({
          message:
            "Cannot view site as a user whose role has been removed. Assign them a role first.",
        });
      }

      const session = req.sessionData;
      session.originalAdminId = session.originalAdminId || session.userId;
      session.originalRole = "Admin";
      session.userId = targetUser.user_id;
      session.role = targetUser.role;
      session.impersonating = {
        userId: targetUser.user_id,
        name: targetUser.name,
        email: targetUser.username,
        role: targetUser.role,
      };

      return res.json({
        message: `Now viewing site as ${targetUser.name} (${targetUser.role})`,
        role: targetUser.role,
        impersonating: session.impersonating,
      });
    } catch (error) {
      console.error("Admin impersonate error:", error);
      return res.status(500).json({ message: "Failed to switch view mode" });
    }
  }
);

 //Stop Impersonating and Return to Admin Identity
app.post(
  "/api/admin/stop-impersonating",
  requireLogin,
  requireAdmin,
  async (req, res) => {
    try {
      const session = req.sessionData;
      if (session.originalAdminId) {
        session.userId = session.originalAdminId;
        session.role = "Admin";
        delete session.originalAdminId;
        delete session.originalRole;
        delete session.impersonating;
      }

      return res.json({
        message: "Returned to Administrator view",
        role: "Admin",
      });
    } catch (error) {
      console.error("Stop impersonating error:", error);
      return res
        .status(500)
        .json({ message: "Failed to exit impersonation mode" });
    }
  }
);

 // Update AboutPage Sprint Metadata from Admin Panel
app.post("/api/admin/about", requireLogin, requireAdmin, async (req, res) => {
  try {
    const {
      teamNumber,
      versionNumber,
      releaseDate,
      productName,
      productDescription,
    } = req.body || {};

    if (
      !teamNumber ||
      !versionNumber ||
      !releaseDate ||
      !productName ||
      !productDescription
    ) {
      return res
        .status(400)
        .json({ message: "All About Page fields are required" });
    }

    await pool.query(
      `
        INSERT INTO AboutPage (team_number, version_number, release_date, product_name, product_description)
        VALUES (?, ?, ?, ?, ?);
      `,
      [
        String(teamNumber).trim(),
        String(versionNumber).trim(),
        releaseDate,
        String(productName).trim(),
        String(productDescription).trim(),
      ]
    );

    return res
      .status(201)
      .json({ message: "About page sprint entry added successfully" });
  } catch (error) {
    console.error("Update about page error:", error);
    return res
      .status(500)
      .json({ message: "Failed to update About page info" });
  }
});

// Audit Log Endpoints (with Category and Date Range filtering)
app.get("/api/audit-logs", requireLogin, requireAdmin, async (req, res) => {
  try {
    const { category, startDate, endDate, role } = req.query;
    const conditions = [];
    const params = [];

    let query = `
      SELECT A.*, U.role AS user_role
      FROM AuditLog A
      LEFT JOIN Users U ON A.username = U.username
    `;

    if (category && category !== "All") {
      conditions.push("A.event_category = ?");
      params.push(category);
    }
    if (role && role !== "All") {
      conditions.push("U.role = ?");
      params.push(role);
    }
    if (startDate) {
      conditions.push("A.event_date >= ?");
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      conditions.push("A.event_date <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY A.event_date DESC LIMIT 500;";
    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get("/api/audit-logs/drivers", requireLogin, requireAdmin, async (req, res) =>
{
  try
  {
    const query = `
      SELECT A.*
      FROM AuditLog A
      JOIN Users U ON A.username = U.username
      WHERE U.role = 'Driver'
      ORDER BY A.username ASC, A.event_date DESC;
    `;

    const [rows] = await pool.query(query);

    res.json(rows);
  }
  catch (error)
  {
    console.error("Error fetching driver audit logs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/audit-logs/sponsors", requireLogin, requireAdmin, async (req, res) =>
{
  try
  {
    const query = `
      SELECT A.*
      FROM AuditLog A
      JOIN Users U ON A.username = U.username
      WHERE U.role = 'Sponsor'
      ORDER BY A.username ASC, A.event_date DESC;
    `;

    const [rows] = await pool.query(query);

    res.json(rows);
  }
  catch (error)
  {
    console.error("Error fetching sponsor audit logs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- SERVER STARTUP ---
if (require.main === module) {
  verifyDatabaseConnection();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
