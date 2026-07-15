const fs = require('node:fs/promises');
const path = require('node:path');

function pendingMigrations(files, applied) {
  const appliedSet = new Set(applied);
  return files.filter((file) => file.endsWith('.sql') && !appliedSet.has(file)).sort();
}

async function runMigrations(db, directory = path.join(__dirname, '..', 'migrations')) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await db.query('SELECT name FROM schema_migrations');
  const files = pendingMigrations(await fs.readdir(directory), rows.map((row) => row.name));

  for (const file of files) {
    const sql = await fs.readFile(path.join(directory, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log(`Applied database migration: ${file}`);
  }
  return files;
}

module.exports = { pendingMigrations, runMigrations };
