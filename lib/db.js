import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let database;

export function getDatabase() {
  if (database) return database;

  const configuredPath = process.env.DATABASE_PATH || './data/studydeck.sqlite';
  const databasePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrations = [
    { version: 1, file: '001-initial.sql' },
    { version: 2, file: '002-categories-tags.sql' },
    { version: 3, file: '003-cloud-progress.sql' },
  ];
  const applied = new Set(database.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
  for (const migrationInfo of migrations) {
    if (applied.has(migrationInfo.version)) continue;
    const sql = fs.readFileSync(path.join(process.cwd(), 'db/migrations', migrationInfo.file), 'utf8');
    const apply = database.transaction(() => {
      database.exec(sql);
      database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(migrationInfo.version, new Date().toISOString());
    });
    apply.immediate();
  }

  return database;
}
