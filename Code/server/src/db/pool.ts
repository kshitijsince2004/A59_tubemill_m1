import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getConnectionString, getDatabase } from '@netlify/database';
import { config, isLocalDatabaseUrl, isNetlifyRuntime } from '../config';

type AnyPool = {
  connect: () => Promise<PoolClient>;
  query: Pool['query'];
  end: () => Promise<void>;
};

let poolInstance: AnyPool | null = null;

function poolFromConnectionString(connectionString: string): AnyPool {
  // Prefer Netlify helper (Neon serverless driver when available).
  try {
    return getDatabase({ connectionString }).pool as unknown as AnyPool;
  } catch {
    const needsSsl = /neon\.tech|supabase\.co|amazonaws\.com|netlify|sslmode=require/i.test(connectionString);
    return new Pool({
      connectionString,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
  }
}

/**
 * Resolve DB connection for Netlify Functions vs local Docker.
 *
 * Priority:
 * 1. NETLIFY_DB_URL (Netlify Database)
 * 2. Non-localhost DATABASE_URL (Neon / Supabase / any hosted Postgres)
 * 3. Local Docker default (dev only)
 */
function createPool(): AnyPool {
  if (process.env.NETLIFY_DB_URL) {
    return poolFromConnectionString(process.env.NETLIFY_DB_URL);
  }

  try {
    return poolFromConnectionString(getConnectionString());
  } catch {
    // not configured
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !isLocalDatabaseUrl(databaseUrl)) {
    return poolFromConnectionString(databaseUrl);
  }

  const onNetlify = isNetlifyRuntime() || config.isNetlify;
  if (onNetlify) {
    throw new Error(
      'No database URL on Netlify. Either: (1) Data & Storage → Database → Create (sets NETLIFY_DB_URL), ' +
        'or (2) set DATABASE_URL to a hosted Postgres URL (Neon/Supabase) — not localhost:5433. Then redeploy.',
    );
  }

  return new Pool({ connectionString: config.databaseUrl });
}

function getPool(): AnyPool {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
}

/** Lazy proxy so module import does not connect before env is available. */
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const instance = getPool() as unknown as Pool;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(instance) : value;
  },
});

/**
 * Tenant GUC is transaction-local (`set_config(..., true)`).
 * Wrap set_config + queries in BEGIN/COMMIT so RLS policies see app.tenant_id
 * on managed Postgres (non-superuser + FORCE ROW LEVEL SECURITY).
 */
async function withTenant<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
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
