/**
 * Dashboard graph series APIs smoke (AUTH_ALLOW_HEADER_ROLE=true, seeded DB, server running).
 * Usage: npm run smoke:dashboard-graphs -w server
 */
import { config } from './config';

const base = `http://127.0.0.1:${config.port}`;

async function call(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'st-auth-mode': 'header',
  };
  if (opts.role) headers['x-app-role'] = opts.role;
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  if (!config.allowHeaderRole) {
    console.error('Set AUTH_ALLOW_HEADER_ROLE=true');
    process.exit(1);
  }

  const checks = [];

  const phTrend = await call('/api/reports/plant-head/trend?windowDays=7', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'PH trend series',
    ok:
      phTrend.status === 200 &&
      Array.isArray(phTrend.json?.data?.series) &&
      phTrend.json.data.series.length === 7,
    detail: `status=${phTrend.status} n=${phTrend.json?.data?.series?.length}`,
  });

  const phStages = await call('/api/reports/plant-head/stages?windowDays=7', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'PH stage throughput',
    ok:
      phStages.status === 200 &&
      Array.isArray(phStages.json?.data?.stages) &&
      phStages.json.data.stages.some((s) => s.process === 'TM'),
    detail: `status=${phStages.status}`,
  });

  const mhTrend = await call('/api/reports/machine-head/trend?process=TM&windowDays=7', {
    role: 'MACHINE_HEAD',
  });
  checks.push({
    name: 'MH trend series',
    ok:
      mhTrend.status === 200 &&
      Array.isArray(mhTrend.json?.data?.series) &&
      mhTrend.json.data.series.length === 7,
    detail: `status=${mhTrend.status} n=${mhTrend.json?.data?.series?.length}`,
  });

  const mhQual = await call('/api/reports/machine-head/quality?process=FUR&windowDays=14', {
    role: 'MACHINE_HEAD',
  });
  checks.push({
    name: 'MH FUR quality series',
    ok:
      mhQual.status === 200 &&
      mhQual.json?.data?.process === 'FUR' &&
      Array.isArray(mhQual.json?.data?.series),
    detail: `status=${mhQual.status} series=${mhQual.json?.data?.series?.length}`,
  });

  const pending = await call('/api/reports/machine-head/pending', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'MH pending aging buckets',
    ok:
      pending.status === 200 &&
      pending.json?.data?.aging &&
      typeof pending.json.data.aging.under1h === 'number' &&
      typeof pending.json.data.aging.over4h === 'number',
    detail: `status=${pending.status}`,
  });

  const opDeny = await call('/api/reports/plant-head/trend', { role: 'OPERATOR' });
  checks.push({
    name: 'OPERATOR denied PH trend',
    ok: opDeny.status === 403 || opDeny.status === 401,
    detail: `status=${opDeny.status}`,
  });

  // Out-of-scope machine should 403 for scoped MH (or empty if ADMIN-like); MACHINE_HEAD with bogus code
  const outScope = await call('/api/reports/machine-head/trend?machine=__NO_SUCH_MILL__', {
    role: 'MACHINE_HEAD',
  });
  checks.push({
    name: 'MH out-of-scope machine rejected or empty-safe',
    ok: outScope.status === 403 || (outScope.status === 200 && Array.isArray(outScope.json?.data?.series)),
    detail: `status=${outScope.status}`,
  });

  let failed = 0;
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name} (${c.detail})`);
    if (!c.ok) failed += 1;
  }
  if (failed) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
  }
  console.log('smoke:dashboard-graphs OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
