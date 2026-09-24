import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Avoid __dirname (undefined when esbuild-bundled as ESM for Netlify Functions).
const envCandidates = [
path.resolve(process.cwd(), '.env'),
path.resolve(process.cwd(), '../.env')];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}


const VALID_ROLES = ['OPERATOR', 'MACHINE_HEAD', 'PLANT_HEAD', 'ADMIN'];

function parseAppRole(raw, fallback) {
  const upper = (raw ?? fallback).toUpperCase();
  return VALID_ROLES.includes(upper) ? upper : fallback;
}

/** True in Netlify Functions / builds even when NETLIFY is unset at runtime. */
export function isNetlifyRuntime() {
  return Boolean(
    process.env.NETLIFY ||
    process.env.NETLIFY_DEV ||
    process.env.NETLIFY_DB_URL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.CONTEXT === 'production' ||
    process.env.CONTEXT === 'deploy-preview' ||
    process.env.CONTEXT === 'branch-deploy'
  );
}

export function isLocalDatabaseUrl(url) {
  if (!url) return false;
  return /localhost|127\.0\.0\.1/i.test(url);
}

const isNetlify = isNetlifyRuntime();
const isProduction = process.env.NODE_ENV === 'production' || isNetlify;

/**
 * Deployed auth decision:
 * Prefer SuperTokens sessions. AUTH_ALLOW_HEADER_ROLE is a local/dev escape hatch only.
 * On Netlify, set SUPERTOKENS_CONNECTION_URI and AUTH_ALLOW_HEADER_ROLE=false.
 */
const authModeRaw = (
process.env.AUTH_MODE ?? (isNetlify || process.env.NODE_ENV === 'production' ? 'static' : 'dev')).
toLowerCase();
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
function resolveConfiguredDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv && !(isNetlify && isLocalDatabaseUrl(fromEnv))) {
    return fromEnv;
  }
  return 'postgresql://tubemill:tubemill@localhost:5433/tubemill';
}

const superTokensConnectionUri =
process.env.SUPERTOKENS_CONNECTION_URI ?? (
isProduction ? '' : 'http://localhost:3567');
const authStrict =
process.env.AUTH_STRICT === 'true' ||
isProduction && process.env.AUTH_STRICT !== 'false';
/**
 * Dev-only: accept x-app-role when no SuperTokens session is present.
 * Impossible in production / Netlify regardless of AUTH_ALLOW_HEADER_ROLE.
 */
const allowHeaderRole =
  !isProduction && (
    process.env.AUTH_ALLOW_HEADER_ROLE === 'true' ||
    authMode === 'dev' && process.env.AUTH_ALLOW_HEADER_ROLE !== 'false'
  );

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: resolveConfiguredDatabaseUrl(),
  tenantId: tenantFromEnv,
  collectorMode: (process.env.COLLECTOR_MODE ?? 'sim').toLowerCase(),
  collectorOnDemand,
  serviceToken,
  bcPlanPath: process.env.BC_PLAN_PATH ?? '',
  bcAdapter: (process.env.BC_ADAPTER ?? 'file').toLowerCase(),
  bcBaseUrl: process.env.BC_BASE_URL ?? '',
  bcTenant: process.env.BC_TENANT ?? '',
  bcClientId: process.env.BC_CLIENT_ID ?? '',
  bcClientSecret: process.env.BC_CLIENT_SECRET ?? '',
  yieldTolerancePct: Number(process.env.YIELD_TOLERANCE_PCT ?? 2),
  authMode: authMode,
  staticAppRole: parseAppRole(process.env.STATIC_APP_ROLE, 'OPERATOR'),
  corsOrigin: process.env.CORS_ORIGIN ?? (isProduction ? 'same-origin' : '*'),
  isProduction,
  isNetlify,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  superTokensConnectionUri,
  superTokensApiKey: process.env.SUPERTOKENS_API_KEY ?? '',
  superTokensEnabled: Boolean(superTokensConnectionUri),
  authStrict,
  allowHeaderRole,
  apiDomain: process.env.API_DOMAIN ?? `http://localhost:${process.env.PORT ?? 3001}`,
  websiteDomain: process.env.WEBSITE_DOMAIN ?? 'http://localhost:5173',
  // Must match client SuperTokens apiBasePath (/api/auth). Vite proxy forwards /api intact.
  apiBasePath: process.env.API_BASE_PATH ?? '/api/auth',
  websiteBasePath: process.env.WEBSITE_BASE_PATH ?? '/auth'
};

export function assertProductionSecrets() {
  if (!config.isProduction) return;

  if (!config.superTokensConnectionUri) {
    throw new Error(
      'SUPERTOKENS_CONNECTION_URI is required when NODE_ENV=production or on Netlify'
    );
  }

  const usingDefaultToken =
    !process.env.SERVICE_TOKEN || config.serviceToken === 'dev-service-token';
  if (usingDefaultToken) {
    throw new Error('Set a non-default SERVICE_TOKEN when NODE_ENV=production or on Netlify');
  }

  const usingDefaultDb =
    /tubemill:tubemill@/i.test(config.databaseUrl) ||
    isLocalDatabaseUrl(config.databaseUrl) && isNetlify;
  if (usingDefaultDb) {
    throw new Error(
      'Set a non-default DATABASE_URL / NETLIFY_DB_URL when NODE_ENV=production or on Netlify'
    );
  }
}

export function assertCollectorModeSupported() {
  if (config.collectorMode !== 'sim') {
    throw new Error(
      `COLLECTOR_MODE=${config.collectorMode} is not implemented. Use COLLECTOR_MODE=sim (sim adapter) until a plant PLC driver is wired.`
    );
  }
}

export function assertBcAdapterSupported() {
  if (config.bcAdapter !== 'file') {
    throw new Error(
      `BC_ADAPTER=${config.bcAdapter} is not implemented. Use BC_ADAPTER=file until live Dynamics OData is wired.`
    );
  }
}