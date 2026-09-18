import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getConnectionString, getDatabase } from '@netlify/database';
import { config } from '../config';

type AnyPool = {
  connect: () => Promise<PoolClient>;
  query: Pool['query'];
  end: () => Promise<void>;
};

let poolInstance: AnyPool | null = null;

function isLocalDockerUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Resolve DB connection for Netlify Functions vs local Docker.
 * Never silently fall back to localhost:5433 inside Netlify — that yields ECONNREFUSED 500s.
 */
function createPool(): AnyPool {
  const netlifyUrl = process.env.NETLIFY_DB_URL;

  if (netlifyUrl) {
    // getDatabase() picks Neon serverless pool when NETLIFY_DB_DRIVER=serverless
    return getDatabase({ connectionString: netlifyUrl }).pool as unknown as AnyPool;
  }

  try {
    const url = getConnectionString();
    return getDatabase({ connectionString: url }).pool as unknown as AnyPool;
  } catch {
    // no Netlify DB env
  }

  if (config.isNetlify || process.env.NETLIFY || process.env.NETLIFY_DEV) {
    throw new Error(
      'NETLIFY_DB_URL is not set. Enable Netlify Database (Project → Data & Storage → Database), ' +
        'ensure @netlify/database is a root dependency, and redeploy. ' +
        'Refusing to use localhost inside a Netlify Function.',
    );
  }

  const localUrl = config.databaseUrl;
  if (process.env.NODE_ENV === 'production' && isLocalDockerUrl(localUrl)) {
    throw new Error(
      `DATABASE_URL points at ${localUrl}, which is unreachable from Netlify. Set NETLIFY_DB_URL or enable Netlify Database.`,
    );
  }

  return new Pool({ connectionString: localUrl });
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
