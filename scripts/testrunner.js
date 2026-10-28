require("dotenv").config();
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";

const TEST_DB_NAME = `chilis_test_${process.pid}_${Date.now()}`;

const SERVER_PORT = 5000;

const SCHEMA_PATH = path.join(__dirname, "..", "database", "migrations");

let serverProcess = null;


function runCommand(command, args, env = {}, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      cwd,
      env: {
        ...process.env,
        ...env
      }
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} exited with code ${code}`)
        );
      }
    });
  });
}

async function createTestDatabase() {
  console.log(`\nCreating test database: ${TEST_DB_NAME}`);

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD
  });

  await connection.query(
    `CREATE DATABASE \`${TEST_DB_NAME}\``
  );

  await connection.end();

  console.log("Test database created.");
}


async function loadSchema() {
  console.log("\nLoading database schemas...");

  const migrationFiles = fs
    .readdirSync(SCHEMA_PATH, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME,
    multipleStatements: true
  });
  try {
    for (const file of migrationFiles) {
      console.log(`Loading schema: ${file}`);

      const schemaPath = path.join(SCHEMA_PATH, file);
      const schema = fs.readFileSync(schemaPath, "utf8");

      await connection.query(schema);
    }

    console.log("All database schemas loaded.");
  } finally {
    await connection.end();
  }
}


function startServer() {
  return new Promise((resolve, reject) => {
    console.log(`\nStarting test server on port ${SERVER_PORT}...`);

    serverProcess = spawn(
      "node",
      ["server/server.js"],
      {
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,

          NODE_ENV: "test",

          PORT: SERVER_PORT,

          DB_HOST,
          DB_PORT,
          DB_USER,
          DB_PASSWORD,

          DB_NAME: TEST_DB_NAME
        }
      }
    );

    setTimeout(() => {
      resolve();
    }, 1500);

    serverProcess.on("error", reject);
  });
}


function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess) {
      resolve();
      return;
    }

    console.log("\nStopping test server...");

    serverProcess.on("close", () => {
      resolve();
    });

    serverProcess.kill();
  });
}

async function deleteTestDatabase() {
  console.log(`\nDeleting test database: ${TEST_DB_NAME}`);

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD
  });

  if (!TEST_DB_NAME.startsWith("chilis_test_")) {
    throw new Error(
      "Refusing to delete database that does not look like a test database."
    );
  }

  await connection.query(
    `DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``
  );

  await connection.end();

  console.log("Test database deleted.");
}
async function createAdminUser() {
  console.log("\nCreating test admin user...");
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: TEST_DB_NAME
  });

  try {
    const username = "admin@email.com";
    const password = "AdminTest";
    const passwordHash = await bcrypt.hash(password, 10);

    await connection.execute(
      `INSERT INTO Users (
        name,
        username,
        password_hash,
        role
      )
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = VALUES(username)`,
      [
        "John Admin",
        username,
        passwordHash,
        "Admin",
      ]
    );
  } finally {
    await connection.end();
  }
}

async function main() {
  let testsPassed = false;

  try {
    await createTestDatabase();

    await loadSchema();

    await createAdminUser();

    await startServer();

    console.log("\n====================");
    console.log("Running Jest...");
    console.log("====================\n");

    await runCommand(
      "npx",["jest", "server"],
      {
        NODE_ENV: "test",
        PORT: SERVER_PORT,
        DB_NAME: TEST_DB_NAME
      }
    );

    console.log("\n====================");
    console.log("Running Playwright...");
    console.log("====================\n");

    await runCommand(
      "npx",["playwright", "test"],
      {
        NODE_ENV: "test",
        PORT: SERVER_PORT,
        DB_NAME: TEST_DB_NAME
      },
      path.join(__dirname, "..", "client")
    );

    testsPassed = true;

    console.log("\n====================");
    console.log("ALL TESTS PASSED");
    console.log("====================\n");

  } catch (error) {
    console.error("\nTESTS FAILED");
    console.error(error);

    process.exitCode = 1;

  } finally {
    await stopServer();

    try {
      await deleteTestDatabase();
    } catch (cleanupError) {
      console.error(
        "\nWARNING: Could not delete test database:"
      );
      console.error(cleanupError.message);

      process.exitCode = 1;
    }

    if (testsPassed) {
      console.log("\nTest cleanup complete.");
    }
  }
}

main();