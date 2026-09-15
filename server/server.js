const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const mysql = require("mysql2/promise");

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

async function createAuditLog(
  eventType,
  action,
  userId = null,
  driverId = null,
  sponsorId = null,
  status = null,
  reason = null,
  details = null
)
{
  try
  {
    const query = `
      INSERT INTO AuditLog
      (
        event_type,
        user_id,
        driver_id,
        sponsor_id,
        action,
        status,
        reason,
        details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await pool.query(query,
    [
      eventType,
      userId,
      driverId,
      sponsorId,
      action,
      status,
      reason,
      details
    ]);
  }
  catch (error)
  {
    console.error("Error creating audit log:", error);
  }
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