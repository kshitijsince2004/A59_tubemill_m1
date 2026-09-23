import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate() {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  await pool.query('CREATE SCHEMA IF NOT EXISTS ops');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops.migrations (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Bridge pre-005 ledger if present
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'demo' AND table_name = 'migrations'
      ) THEN
        INSERT INTO ops.migrations (name, applied_at)
        SELECT name, applied_at FROM demo.migrations
        ON CONFLICT (name) DO NOTHING;
      END IF;
    END $$;
  `);

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM ops.migrations WHERE name = $1', [file]);
    if (applied.rowCount && applied.rowCount > 0) {
      console.log(`Skip ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO ops.migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('Migrations complete.');
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});