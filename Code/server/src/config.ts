import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Avoid __dirname (undefined when esbuild-bundled as ESM for Netlify Functions).
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

type AppRole = 'OPERATOR' | 'SUPERVISOR' | 'PLANT_HEAD' | 'ADMIN';
const VALID_ROLES: AppRole[] = ['OPERATOR', 'SUPERVISOR', 'PLANT_HEAD', 'ADMIN'];

function parseAppRole(raw: string | undefined, fallback: AppRole): AppRole {
  const upper = (raw ?? fallback).toUpperCase();
  return (VALID_ROLES.includes(upper as AppRole) ? upper : fallback) as AppRole;
}

/** True in Netlify Functions / builds even when NETLIFY is unset at runtime. */
export function isNetlifyRuntime(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_DEV ||
      process.env.NETLIFY_DB_URL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.CONTEXT === 'production' ||
      process.env.CONTEXT === 'deploy-preview' ||
      process.env.CONTEXT === 'branch-deploy',
  );
}

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /localhost|127\.0\.0\.1/i.test(url);
}

const isNetlify = isNetlifyRuntime();
const isProduction = process.env.NODE_ENV === 'production' || isNetlify;

/**
 * Deployed auth decision (demo / Netlify):
 * Neither AUTH_MODE authenticates users — endpoints remain publicly reachable.
 * Prefer `static` on Netlify so visitors cannot elevate to ADMIN via x-app-role.
 * Override with AUTH_MODE=dev in Netlify env if the login role picker is needed for a private demo.
 */
const authModeRaw = (
  process.env.AUTH_MODE ?? (isNetlify || process.env.NODE_ENV === 'production' ? 'static' : 'dev')
).toLowerCase();
const authMode = authModeRaw === 'static' ? 'static' : 'dev';

const tenantFromEnv =
  process.env.TENANT_ID ?? process.env.DEMO_TENANT_ID ?? '00000000-0000-4000-8000-000000000001';

if (process.env.DEMO_TENANT_ID && !process.env.TENANT_ID) {
  console.warn('[config] DEMO_TENANT_ID is deprecated; use TENANT_ID');
}

const serviceToken = process.env.SERVICE_TOKEN ?? 'dev-service-token';

if (authMode === 'static' && !process.env.STATIC_APP_ROLE) {
  console.warn('[config] AUTH_MODE=static without STATIC_APP_ROLE; defaulting to OPERATOR');
}

/** Drive sim collector per request when on Netlify (no long-lived timers). */
const collectorOnDemand =
  process.env.COLLECTOR_DRIVE === 'on_demand' ||
  isNetlify ||
  process.env.COLLECTOR_DRIVE === 'request';

/**
 * Local Docker URL from a copied .env must never be used on Netlify.
 * Prefer NETLIFY_DB_URL; ignore localhost DATABASE_URL in Functions.
 */
function resolveConfiguredDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv && !(isNetlify && isLocalDatabaseUrl(fromEnv))) {
    return fromEnv;
  }
  return 'postgresql://tubemill:tubemill@localhost:5433/tubemill';
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: resolveConfiguredDatabaseUrl(),
  tenantId: tenantFromEnv,
  collectorMode: (process.env.COLLECTOR_MODE ?? 'sim').toLowerCase(),
  collectorOnDemand,
  serviceToken,
  bcPlanPath: process.env.BC_PLAN_PATH ?? '',
  bcAdapter: (process.env.BC_ADAPTER ?? 'file').toLowerCase(),
  yieldTolerancePct: Number(process.env.YIELD_TOLERANCE_PCT ?? 2),
  authMode: authMode as 'dev' | 'static',
  staticAppRole: parseAppRole(process.env.STATIC_APP_ROLE, 'OPERATOR'),
  corsOrigin: process.env.CORS_ORIGIN ?? (isProduction ? 'same-origin' : '*'),
  isProduction,
  isNetlify,
  nodeEnv: process.env.NODE_ENV ?? 'development',
};

export function assertProductionSecrets(): void {
  const usingDefaultToken =
    !process.env.SERVICE_TOKEN || config.serviceToken === 'dev-service-token';
  if (!config.isProduction || !usingDefaultToken) return;

  // Demo Netlify sites often paste the local .env (including dev-service-token).
  // Warn instead of crashing the function with 502 when AUTH_MODE=dev.
  if (authMode === 'dev' && isNetlify) {
    console.warn(
      '[config] SERVICE_TOKEN is still the local default. Set a non-default SERVICE_TOKEN in Netlify env for any shared URL.',
    );
    return;
  }

  throw new Error('Set a non-default SERVICE_TOKEN when NODE_ENV=production or on Netlify');
}

export function assertCollectorModeSupported(): void {
  if (config.collectorMode !== 'sim') {
    throw new Error(
      `COLLECTOR_MODE=${config.collectorMode} is not implemented. Use COLLECTOR_MODE=sim (sim adapter) until a plant PLC driver is wired.`,
    );
  }
}

export function assertBcAdapterSupported(): void {
  if (config.bcAdapter !== 'file') {
    throw new Error(
      `BC_ADAPTER=${config.bcAdapter} is not implemented. Use BC_ADAPTER=file until live Dynamics OData is wired.`,
    );
  }
}
