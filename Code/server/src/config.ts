import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type AppRole = 'OPERATOR' | 'SUPERVISOR' | 'PLANT_HEAD' | 'ADMIN';
const VALID_ROLES: AppRole[] = ['OPERATOR', 'SUPERVISOR', 'PLANT_HEAD', 'ADMIN'];

function parseAppRole(raw: string | undefined, fallback: AppRole): AppRole {
  const upper = (raw ?? fallback).toUpperCase();
  return (VALID_ROLES.includes(upper as AppRole) ? upper : fallback) as AppRole;
}

const authModeRaw = (process.env.AUTH_MODE ?? (process.env.NODE_ENV === 'production' ? 'static' : 'dev')).toLowerCase();
const authMode = authModeRaw === 'static' ? 'static' : 'dev';

const tenantFromEnv =
  process.env.TENANT_ID ?? process.env.DEMO_TENANT_ID ?? '00000000-0000-4000-8000-000000000001';

if (process.env.DEMO_TENANT_ID && !process.env.TENANT_ID) {
  console.warn('[config] DEMO_TENANT_ID is deprecated; use TENANT_ID');
}

const serviceToken = process.env.SERVICE_TOKEN ?? 'dev-service-token';
const isProduction = process.env.NODE_ENV === 'production';

if (authMode === 'static' && !process.env.STATIC_APP_ROLE) {
  console.warn('[config] AUTH_MODE=static without STATIC_APP_ROLE; defaulting to OPERATOR');
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://tubemill:tubemill@localhost:5433/tubemill',
  tenantId: tenantFromEnv,
  collectorMode: (process.env.COLLECTOR_MODE ?? 'sim').toLowerCase(),
  serviceToken,
  bcPlanPath: process.env.BC_PLAN_PATH ?? '',
  bcAdapter: (process.env.BC_ADAPTER ?? 'file').toLowerCase(),
  yieldTolerancePct: Number(process.env.YIELD_TOLERANCE_PCT ?? 2),
  authMode: authMode as 'dev' | 'static',
  staticAppRole: parseAppRole(process.env.STATIC_APP_ROLE, 'OPERATOR'),
  corsOrigin: process.env.CORS_ORIGIN ?? (isProduction ? 'same-origin' : '*'),
  isProduction,
  nodeEnv: process.env.NODE_ENV ?? 'development',
};

export function assertProductionSecrets(): void {
  if (config.isProduction && (!process.env.SERVICE_TOKEN || config.serviceToken === 'dev-service-token')) {
    throw new Error('Set a non-default SERVICE_TOKEN when NODE_ENV=production');
  }
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
