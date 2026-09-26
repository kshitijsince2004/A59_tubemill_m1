import { Pool } from 'pg';
import { getConnectionString, getDatabase } from '@netlify/database';
import { config, isLocalDatabaseUrl, isNetlifyRuntime } from '../config';

/** @typedef {import('pg').PoolClient} PoolClient */

/** @type {{ connect: () => Promise<PoolClient>, query: Pool['query'], end: () => Promise<void> } | null} */
let poolInstance = null;

/**
 * @param {string} connectionString
 */
function poolFromConnectionString(connectionString) {
  // Prefer Netlify helper (Neon serverless driver when available).
  try {
    return getDatabase({ connectionString }).pool;
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
function createPool() {
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

function getPool() {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
}

/** Lazy proxy so module import does not connect before env is available. */
export const pool = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const instance = getPool();
      const value = Reflect.get(instance, prop, receiver);
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  },
);

/**
 * Tenant GUC is transaction-local (`set_config(..., true)`).
 * Wrap set_config + queries in BEGIN/COMMIT so RLS policies see app.tenant_id
 * on managed Postgres (non-superuser + FORCE ROW LEVEL SECURITY).
 * @template T
 * @param {(client: PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTenant(fn) {
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

/**
 * Run multiple statements atomically with a single tenant GUC (audit F6 / F15).
 * @template T
 * @param {(client: PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  return withTenant(fn);
}

/**
 * @param {string} text
 * @param {unknown[]} [params]
 * @param {PoolClient} [client] When provided, runs on that client (no nested BEGIN).
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function query(text, params, client) {
  if (client) {
    const result = await client.query(text, params);
    return result.rows;
  }
  return withTenant(async (c) => {
    const result = await c.query(text, params);
    return result.rows;
  });
}

/**
 * @param {string} text
 * @param {unknown[]} [params]
 * @param {PoolClient} [client]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function queryOne(text, params, client) {
  const rows = await query(text, params, client);
  return rows[0] ?? null;
}

/**
 * @param {PoolClient} client
 * @param {string} text
 * @param {unknown[]} [params]
 */
export async function queryOn(client, text, params) {
  return query(text, params, client);
}

/**
 * @param {PoolClient} client
 * @param {string} text
 * @param {unknown[]} [params]
 */
export async function queryOneOn(client, text, params) {
  return queryOne(text, params, client);
}

/** Drain and close the pool (graceful shutdown). Safe to call multiple times. */
export async function closePool() {
  if (!poolInstance) return;
  const instance = poolInstance;
  poolInstance = null;
  if (typeof instance.end === 'function') {
    await instance.end();
  }
}
