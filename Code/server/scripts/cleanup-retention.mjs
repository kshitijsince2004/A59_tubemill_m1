#!/usr/bin/env node
/**
 * Manual retention cleanup (audit F28).
 *
 * Deletes:
 *   - txn.idempotency_key older than 30 days
 *   - erp.writeback_job rows with status LOGGED older than 90 days
 *
 * Usage:
 *   node scripts/cleanup-retention.mjs
 *   DATABASE_URL=... node scripts/cleanup-retention.mjs
 *
 * Requires DATABASE_URL or NETLIFY_DB_URL. Safe to re-run.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const connectionString =
  process.env.NETLIFY_DB_URL || process.env.DATABASE_URL || '';

if (!connectionString) {
  console.error('cleanup-retention: set DATABASE_URL or NETLIFY_DB_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

async function cleanupRetention(client = pool) {
  const idem = await client.query(
    `DELETE FROM txn.idempotency_key
     WHERE created_at < now() - interval '30 days'
     RETURNING 1`
  );
  const wb = await client.query(
    `DELETE FROM erp.writeback_job
     WHERE status = 'LOGGED'
       AND COALESCE(updated_at, created_at) < now() - interval '90 days'
     RETURNING 1`
  );
  return {
    idempotencyDeleted: idem.rowCount ?? 0,
    writebackLoggedDeleted: wb.rowCount ?? 0,
  };
}

try {
  const result = await cleanupRetention();
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'cleanup-retention complete',
      ...result,
    })
  );
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

export { cleanupRetention };
