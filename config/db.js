const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: "45.79.122.142",
  user: "globalproperties_global",
  port: "3306",
  password: "09rQ}h7qDNZ9",
  database: "globalproperties_global_properties",
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
