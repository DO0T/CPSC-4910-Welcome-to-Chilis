const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function seedUser() {
  // Use the same pool configuration from your server.js
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const plainPassword = "TestPassword123!";
  // Hash the password with a salt round of 10
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  try {
    await pool.query(
      "INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)",
      ["driver@example.com", hashedPassword, "Driver"]
    );
    console.log("Test driver inserted successfully!");
  } catch (error) {
    console.error("Error inserting user:", error);
  } finally {
    pool.end();
  }
}

seedUser();