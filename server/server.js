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

verifyDatabaseConnection();

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

    return res.status(200).json
    ({ 
      message: "Login successful",
      role: userRecord.role,
      id: userRecord.user_id
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