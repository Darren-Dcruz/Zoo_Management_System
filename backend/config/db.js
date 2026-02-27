const mysql = require('mysql2');
require('dotenv').config();

function resolveDbConfig() {
  let host = process.env.DB_HOST || process.env.MYSQLHOST;
  let port = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306);
  let user = process.env.DB_USER || process.env.MYSQLUSER;
  let password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
  let database = process.env.DB_NAME || process.env.MYSQLDATABASE;

  const connectionUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

  // Fallback for providers that expose only one connection URL.
  if ((!host || !user || !database) && connectionUrl) {
    try {
      const parsed = new URL(connectionUrl);
      host = host || parsed.hostname;
      port = Number.isFinite(port) ? port : Number(parsed.port || 3306);
      user = user || decodeURIComponent(parsed.username || '');
      password = password || decodeURIComponent(parsed.password || '');
      database = database || parsed.pathname.replace(/^\//, '');
    } catch (_error) {
      console.error('Database URL parsing failed. Check MYSQL_URL / DATABASE_URL format.');
    }
  }

  return {
    host,
    port: Number.isFinite(port) ? port : 3306,
    user,
    password,
    database,
  };
}

const dbConfig = resolveDbConfig();

console.log(
  `DB config -> host=${dbConfig.host || 'missing'} port=${dbConfig.port} user=${dbConfig.user || 'missing'} database=${dbConfig.database || 'missing'}`,
);

const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Validate DB connectivity once at startup.
pool.getConnection((err, connection) => {
  if (err) {
    console.error(
      `Database connection failed: code=${err.code || 'unknown'} message=${err.message || 'n/a'} host=${dbConfig.host || 'missing'} port=${dbConfig.port}`,
    );
  } else {
    console.log('Connected to MySQL database');
    connection.release();
  }
});

module.exports = pool.promise();
