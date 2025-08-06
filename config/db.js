const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root", //global_admin
  port: 3306,
  password: "Mdlala@5253", //09rQ}h7qDNZ9
  database: "global_properties",
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
