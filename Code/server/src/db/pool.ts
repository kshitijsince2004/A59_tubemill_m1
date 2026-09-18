import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getConnectionString, getDatabase } from '@netlify/database';
import { config, isLocalDatabaseUrl, isNetlifyRuntime } from '../config';

type AnyPool = {
  connect: () => Promise<PoolClient>;
  query: Pool['query'];
  end: () => Promise<void>;
};

let poolInstance: AnyPool | null = null;

/**
 * Resolve DB connection for Netlify Functions vs local Docker.
 *
 * Do not paste Code/.env into Netlify:
 *   DATABASE_URL=...@localhost:5433 is unreachable from Functions (ECONNREFUSED).
 * Enable Netlify Database so NETLIFY_DB_URL is injected, and delete DATABASE_URL
 * (or point it at a real remote Postgres).
 */
function createPool(): AnyPool {
  const netlifyUrl = process.env.NETLIFY_DB_URL;

  if (netlifyUrl) {
    return getDatabase({ connectionString: netlifyUrl }).pool as unknown as AnyPool;
  }

  try {
    const url = getConnectionString();
    return getDatabase({ connectionString: url }).pool as unknown as AnyPool;
  } catch {
    // no Netlify DB env
  }

  const onNetlify = isNetlifyRuntime() || config.isNetlify;
  const localUrl = config.databaseUrl;

  if (onNetlify) {
    throw new Error(
      'No NETLIFY_DB_URL. In Netlify: Data & Storage → Database → create/enable, then DELETE ' +
        'DATABASE_URL if it points at localhost:5433 (copied from local .env). Redeploy after that.',
    );
  }

  if (isLocalDatabaseUrl(localUrl) && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(
      'DATABASE_URL points at localhost, which is unreachable from Netlify Functions. ' +
        'Delete DATABASE_URL in Netlify env vars and enable Netlify Database (NETLIFY_DB_URL).',
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
