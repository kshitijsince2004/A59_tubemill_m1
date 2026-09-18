import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getConnectionString } from '@netlify/database';
import { config } from '../config';

function resolveDatabaseUrl(): string {
  // Prefer Netlify Database when the platform injects a connection string.
  try {
    return getConnectionString();
  } catch {
    return config.databaseUrl;
  }
}

export const pool = new Pool({ connectionString: resolveDatabaseUrl() });

/**
 * Tenant GUC is transaction-local (`set_config(..., true)`).
 * Wrap set_config + queries in BEGIN/COMMIT so RLS policies see app.tenant_id
 * on managed Postgres (non-superuser + FORCE ROW LEVEL SECURITY).
 */
async function withTenant<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [config.tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  return withTenant(async (client) => {
    const result = await client.query<T>(text, params);
    return result.rows;
  });
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
