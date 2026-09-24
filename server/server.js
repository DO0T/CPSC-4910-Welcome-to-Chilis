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

verifyDatabaseConnection();

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
  req.authToken = token;
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

// Create a regular user account. The email address is stored as the username,
// matching the existing login route, and passwords are stored only as bcrypt hashes.
app.post("/api/signup", async (req, res) =>
{
  try
  {
    const { name, email, password, profilePictureUrl } = req.body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanProfilePictureUrl = typeof profilePictureUrl === "string" ? profilePictureUrl.trim() : "";

    if (!cleanName || !cleanEmail || typeof password !== "string" || !password)
    {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Basic server-side email format check; the browser's type=email is not enough.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    {
      return res.status(400).json({ message: "Please enter a valid email address" });
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

    const [existingUsers] = await pool.query(
      "SELECT user_id FROM Users WHERE username = ? LIMIT 1;",
      [cleanEmail]
    );
    if (existingUsers.length > 0)
    {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      "INSERT INTO Users (name, username, password_hash, role, profile_picture_url) VALUES (?, ?, ?, ?, ?);",
      [cleanName, cleanEmail, passwordHash, "Driver", cleanProfilePictureUrl || null]
    );

    return res.status(201).json({
      message: "Account created successfully",
      id: result.insertId,
      name: cleanName,
      profilePictureUrl: cleanProfilePictureUrl || null
    });
  }
  catch (error)
  {
    // Also handle duplicate usernames if two signup requests race.
    if (error.code === "ER_DUP_ENTRY")
    {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
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

    if (passwordHash)
    {
      await pool.query(
        "UPDATE Users SET name = ?, username = ?, profile_picture_url = ?, password_hash = ? WHERE user_id = ?;",
        [cleanName, cleanEmail, cleanPictureUrl || null, passwordHash, req.userId]
      );
    }
    else
    {
      await pool.query(
        "UPDATE Users SET name = ?, username = ?, profile_picture_url = ? WHERE user_id = ?;",
        [cleanName, cleanEmail, cleanPictureUrl || null, req.userId]
      );
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
  app.listen(PORT, () => 
  {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

app.get("/api/about", async (req, res) => 
{
  try 
  {
    const query = "SELECT * FROM AboutPage;"; 
    const [rows] = await pool.query(query);

    if (rows.length > 0) 
    {
        res.json(rows[0]);

    } 
    else 
    {
        res.status(404).json({ message: "About information not found" });
    }
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
    const query = "SELECT * FROM DriverPoints;";
    const [rows] = await pool.query(query);

    res.json(rows);
  } 
  catch (error) 
  {
    console.error("Error fetching driver points:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/login", async (req, res) => 
{
  try 
  {
    // grabs the username and password from the frontend (react)
    const {username, password } = req.body;

    if (!username || !password) 
    {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    const query = "SELECT * FROM Users WHERE username = ?;";
    const [rows] = await pool.query(query, [username]);

    if (rows.length === 0) 
    {
      return res.status(401).json({ message: "Invalid username or password" });
    }

  const userRecord = rows[0];   

  const match = await bcrypt.compare(password, userRecord.password_hash);

  if (match) 
  {
    await pool.query 
    (
      "INSERT INTO AuditLog (username, event_category, status, details) VALUES (?, 'Login Attempt', 'Success', 'User logged in sucessfully');",
      [username]
    );

    const sessionToken = crypto.randomBytes(32).toString("hex");
    sessions.set(sessionToken, {
      userId: userRecord.user_id,
      expiresAt: Date.now() + SESSION_DURATION_MS
    });

    return res.status(200).json
    ({ 
      message: "Login successful",
      token: sessionToken,
      role: userRecord.role,
      id: userRecord.user_id,
      name: userRecord.name,
      profilePictureUrl: userRecord.profile_picture_url
    });
  }
  else 
  {
    await pool.query 
    (
      "INSERT INTO AuditLog (username, event_category, status, details) VALUES (?, 'Login Attempt', 'Failure', 'Invalid username or password');",
      [username]
    );
    return res.status(401).json({ message: "Invalid username or password" });
  }
}
catch(error) 
{
  console.error("Login error:", error);
  res.status(500).json({ error: "Internal Server Error" });
}

});

module.exports = app;