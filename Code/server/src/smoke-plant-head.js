/**
 * Plant Head profile smoke (AUTH_ALLOW_HEADER_ROLE=true, seeded DB, server running).
 * Usage: npm run smoke:plant-head -w server
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

  const dash = await call('/api/reports/plant-head', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'plant-head dashboard',
    ok: dash.status === 200 && dash.json?.data?.kpi,
    detail: `status=${dash.status}`,
  });

  const backlog = await call('/api/reports/plant-head/backlog', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'plant-head backlog',
    ok: backlog.status === 200 && backlog.json?.data?.totals,
    detail: `status=${backlog.status}`,
  });

  const mgmt = await call('/api/reports/management?period=7d', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'management dashboard',
    ok: mgmt.status === 200 && mgmt.json?.data?.totals,
    detail: `status=${mgmt.status}`,
  });

  const drill = await call('/api/reports/drilldown', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'drilldown process level',
    ok: drill.status === 200 && drill.json?.data?.level === 'process',
    detail: `status=${drill.status}`,
  });

  const daily = await call('/api/reports/daily', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'daily report',
    ok: daily.status === 200,
    detail: `status=${daily.status}`,
  });

  const orders = await call('/api/reports/orders', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'order tracking',
    ok: orders.status === 200,
    detail: `status=${orders.status}`,
  });

  const reports = await call('/api/plant/exports/reports', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'plant export catalog',
    ok: reports.status === 200 && Array.isArray(reports.json?.data),
    detail: `status=${reports.status}`,
  });

  const history = await call('/api/plant/exports/history', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'export history',
    ok: history.status === 200,
    detail: `status=${history.status}`,
  });

  const audit = await call('/api/audit', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'audit trail',
    ok: audit.status === 200,
    detail: `status=${audit.status}`,
  });

  const mhFromPh = await call('/api/reports/machine-head', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'PH can open MH dashboard API',
    ok: mhFromPh.status === 200,
    detail: `status=${mhFromPh.status}`,
  });

  const trend = await call('/api/reports/plant-head/trend?windowDays=7', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'plant-head trend',
    ok: trend.status === 200 && Array.isArray(trend.json?.data?.series),
    detail: `status=${trend.status}`,
  });

  const stages = await call('/api/reports/plant-head/stages?windowDays=7', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'plant-head stages',
    ok: stages.status === 200 && Array.isArray(stages.json?.data?.stages),
    detail: `status=${stages.status}`,
  });

  const writeDeny = await call('/api/furnace/lots', {
    method: 'POST',
    role: 'PLANT_HEAD',
    body: { chargeNo: 'PH-SMOKE-SKIP', furnaceCode: 'RHF-03' },
  });
  checks.push({
    name: 'PH capture write denied',
    ok: writeDeny.status === 403,
    detail: `status=${writeDeny.status}`,
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
  console.log('smoke:plant-head OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
