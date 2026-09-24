#!/usr/bin/env node
/**
 * Apply Netlify demo SQL migrations during build (avoids platform migrator hang).
 * Tracks applied files in public.a59_schema_migrations.
 *
 * Usage: node netlify/database/apply-sql.mjs
 * Requires: NETLIFY_DB_URL or DATABASE_URL
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(__dirname, 'sql');

const connectionString =
  process.env.NETLIFY_DB_URL ||
  process.env.DATABASE_URL ||
  '';

if (!connectionString) {
  console.error('[apply-sql] NETLIFY_DB_URL / DATABASE_URL missing — skip');
  process.exit(0);
}

if (/localhost|127\.0\.0\.1/i.test(connectionString) && process.env.NETLIFY === 'true') {
  console.error('[apply-sql] refusing localhost DATABASE_URL on Netlify');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: /sslmode=require|neon\.tech|netlify/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
  connectionTimeoutMillis: 30_000,
  statement_timeout: 120_000,
});

async function main() {
  const files = fs
    .readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  console.log(`[apply-sql] ${files.length} file(s) in ${sqlDir}`);
  await client.connect();
  console.log('[apply-sql] connected');

  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.a59_schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = await client.query(`SELECT id FROM public.a59_schema_migrations`);
  const done = new Set(applied.rows.map((r) => r.id));

  for (const file of files) {
    const id = file.replace(/\.sql$/i, '');
    if (done.has(id)) {
      console.log(`[apply-sql] skip ${id}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
    console.log(`[apply-sql] apply ${id} (${sql.length} bytes)…`);
    const started = Date.now();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO public.a59_schema_migrations (id) VALUES ($1)`, [id]);
      await client.query('COMMIT');
      console.log(`[apply-sql] ok ${id} in ${Date.now() - started}ms`);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      console.error(`[apply-sql] FAILED ${id}:`, err.message || err);
      process.exit(1);
    }
  }

  console.log('[apply-sql] complete');
}

main()
  .catch((err) => {
    console.error('[apply-sql] fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  });
