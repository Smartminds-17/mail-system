const fs = require('node:fs/promises');
const path = require('node:path');

function pendingMigrations(files, applied) {
  const appliedSet = new Set(applied);
  return files.filter((file) => file.endsWith('.sql') && !appliedSet.has(file)).sort();
}

async function migrationAlreadyPresent(db, file) {
  if (file !== '001_email_scheduling.sql') return false;
  const [columns] = await db.query(`
    SELECT COUNT(DISTINCT column_name) AS count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'email_jobs'
      AND column_name IN ('status', 'scheduled_at', 'started_at', 'completed_at')
  `);
  const [indexes] = await db.query(`
    SELECT COUNT(*) AS count
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'email_jobs'
      AND index_name = 'idx_email_jobs_due'
  `);
  return Number(columns[0].count) === 4 && Number(indexes[0].count) > 0;
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
    if (await migrationAlreadyPresent(db, file)) {
      await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log(`Adopted existing database migration: ${file}`);
      continue;
    }
    const sql = await fs.readFile(path.join(directory, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log(`Applied database migration: ${file}`);
  }
  return files;
}

module.exports = { migrationAlreadyPresent, pendingMigrations, runMigrations };
