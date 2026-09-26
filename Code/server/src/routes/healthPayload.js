import { query } from '../db/pool';
import { config } from '../config';

/**
 * Shared health payload for GET /health and GET /api/health.
 * Checks database ping and SuperTokens Core reachability when configured.
 */
export async function buildHealthPayload() {
  let db = 'ok';
  let dbError;
  try {
    await query(`SELECT 1 AS ok`);
  } catch (err) {
    db = 'error';
    dbError = err instanceof Error ? err.message : String(err);
  }

  let auth = 'disabled';
  let authError;
  if (config.superTokensEnabled && config.superTokensConnectionUri) {
    auth = 'ok';
    try {
      const base = config.superTokensConnectionUri.replace(/\/$/, '');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${base}/hello`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        auth = 'error';
        authError = `HTTP ${res.status}`;
      }
    } catch (err) {
      auth = 'error';
      authError = err instanceof Error ? err.message : String(err);
    }
  } else if (config.isWindowsPlant || config.authStrict) {
    auth = 'error';
    authError = 'SuperTokens required but SUPERTOKENS_CONNECTION_URI is unset';
  }

  let status = 'ok';
  if (db === 'error' || auth === 'error') {
    status = db === 'error' && auth === 'error' ? 'fail' : 'degraded';
  }

  return {
    status,
    db,
    dbError,
    auth,
    authError,
    deployTarget: config.deployTarget,
    hasNetlifyDbUrl: Boolean(process.env.NETLIFY_DB_URL),
    hasRemoteDatabaseUrl: Boolean(
      process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL)
    ),
    databaseUrlIsLocalhost: /localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL ?? ''),
    context: process.env.CONTEXT ?? null,
    fix:
      db === 'ok'
        ? null
        : config.isWindowsPlant
          ? 'Check PostgreSQL Windows service and DATABASE_URL (loopback).'
          : 'Create Netlify Database OR set DATABASE_URL to a hosted Postgres URL (not localhost). Then redeploy.',
    collectorMode: config.collectorMode,
    bcAdapter: config.bcAdapter,
  };
}
