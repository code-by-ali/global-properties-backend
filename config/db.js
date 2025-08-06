const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Test the connection
pool
  .getConnection()
  .then((connection) => {
    console.log("Successfully connected to the database pool.");
    connection.release();
  })
  .catch((err) => {
    console.error("ERROR CONNECTING TO DATABASE POOL:", err);
  });

// Query function to execute SQL queries
async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

module.exports = { query, pool };
