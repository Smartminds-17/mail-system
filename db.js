const mysql = require('mysql2');
const { loadConfig } = require('./config');
const config = loadConfig();

const db = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const dbPromise = Promise.resolve(db.promise());

async function checkDatabaseConnection() {
  const promiseDb = await dbPromise;
  await promiseDb.query('SELECT 1');
}

module.exports = { db, dbPromise, checkDatabaseConnection };
