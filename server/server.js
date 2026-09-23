const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

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

    const query = `
      INSERT INTO DriverPoints
      (driver_id, sponsor_id, point_change, reason)
      VALUES (?, ?, ?, ?);
    `;

    const [result] = await connection.query(query,
    [
      driver_id,
      sponsor_id,
      point_change,
      reason
    ]);

    await createAuditLog(
      null,
      "Point Change",
      "Success",
      `Driver ID: ${driver_id}; Sponsor ID: ${sponsor_id}; Points changed by ${point_change}; Reason: ${reason}; Transaction ID: ${result.insertId}`,
      connection
    );

    await connection.commit();

    res.status(201).json(
    {
      message: "Driver points updated successfully",
      transaction_id: result.insertId
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

    return res.status(200).json(
    {
      message: "Login successful",
      role: userRecord.role,
      id: userRecord.user_id
    });
  }
  catch (error)
  {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/audit-logs", async (req, res) =>
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