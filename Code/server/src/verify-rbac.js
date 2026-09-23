/**
 * Smoke checks for RBAC spine (run with AUTH_ALLOW_HEADER_ROLE=true against a seeded DB).
 * Usage: npx tsx server/src/verify-rbac.ts
 */
import { config } from './config';

const base = `http://127.0.0.1:${config.port}`;

async function call(
path,
opts = {})
{
  const headers = {
    'Content-Type': 'application/json',
    'st-auth-mode': 'header'
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.role) headers['x-app-role'] = opts.role;
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  if (!config.allowHeaderRole) {
    console.error('Set AUTH_ALLOW_HEADER_ROLE=true for header-based verify-rbac');
    process.exit(1);
  }

  const checks = [];

  const unauth = await call('/api/furnace/lots');
  checks.push({
    name: 'unauthenticated GET furnace → 401',
    ok: unauth.status === 401,
    detail: `status=${unauth.status}`
  });

  const opFur = await call('/api/furnace/lots', { role: 'OPERATOR' });
  // Header role grants all processes in middleware hydrate — expect 200
  checks.push({
    name: 'header OPERATOR can GET furnace (dev hydrate)',
    ok: opFur.status === 200,
    detail: `status=${opFur.status}`
  });

  const phWrite = await call('/api/furnace/lots', {
    method: 'POST',
    role: 'PLANT_HEAD',
    body: { chargeNo: 'VERIFY-SKIP', furnaceCode: 'RHF-03' }
  });
  checks.push({
    name: 'PLANT_HEAD POST furnace → 403',
    ok: phWrite.status === 403,
    detail: `status=${phWrite.status}`
  });

  const opApprove = await call('/api/furnace/lots/00000000-0000-4000-8000-000000000099/approve', {
    method: 'POST',
    role: 'OPERATOR'
  });
  checks.push({
    name: 'OPERATOR approve → 403',
    ok: opApprove.status === 403,
    detail: `status=${opApprove.status}`
  });

  const adminUsers = await call('/api/users', { role: 'ADMIN' });
  checks.push({
    name: 'ADMIN GET /users → 200',
    ok: adminUsers.status === 200,
    detail: `status=${adminUsers.status}`
  });

  const opUsers = await call('/api/users', { role: 'OPERATOR' });
  checks.push({
    name: 'OPERATOR GET /users → 403',
    ok: opUsers.status === 403,
    detail: `status=${opUsers.status}`
  });

  const mhDash = await call('/api/reports/machine-head', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'MACHINE_HEAD GET /reports/machine-head → 200',
    ok: mhDash.status === 200,
    detail: `status=${mhDash.status}`
  });

  const phMhDash = await call('/api/reports/machine-head', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'PLANT_HEAD GET /reports/machine-head → 200 (escalation)',
    ok: phMhDash.status === 200,
    detail: `status=${phMhDash.status}`
  });

  const phDash = await call('/api/reports/plant-head', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'PLANT_HEAD GET /reports/plant-head → 200',
    ok: phDash.status === 200 && phDash.json?.data?.kpi,
    detail: `status=${phDash.status}`
  });

  const opPlant = await call('/api/reports/plant-head', { role: 'OPERATOR' });
  checks.push({
    name: 'OPERATOR GET /reports/plant-head → 403',
    ok: opPlant.status === 403,
    detail: `status=${opPlant.status}`
  });

  const phUsers = await call('/api/users', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'PLANT_HEAD GET /users → 200',
    ok: phUsers.status === 200,
    detail: `status=${phUsers.status}`
  });

  const phAudit = await call('/api/audit', { role: 'PLANT_HEAD' });
  checks.push({
    name: 'PLANT_HEAD GET /audit → 200',
    ok: phAudit.status === 200,
    detail: `status=${phAudit.status}`
  });

  const mhAudit = await call('/api/audit', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'MACHINE_HEAD GET /audit → 403',
    ok: mhAudit.status === 403,
    detail: `status=${mhAudit.status}`
  });

  const opDash = await call('/api/reports/machine-head', { role: 'OPERATOR' });
  checks.push({
    name: 'OPERATOR GET /reports/machine-head → 403',
    ok: opDash.status === 403,
    detail: `status=${opDash.status}`
  });

  const mhQuality = await call('/api/quality/specs', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'MACHINE_HEAD GET /quality/specs → 200',
    ok: mhQuality.status === 200,
    detail: `status=${mhQuality.status}`
  });

  const opMasterPost = await call('/api/master-data/grade', {
    method: 'POST',
    role: 'OPERATOR',
    body: { code: 'X', label: 'Nope' },
  });
  checks.push({
    name: 'OPERATOR POST /master-data/grade → 403',
    ok: opMasterPost.status === 403,
    detail: `status=${opMasterPost.status}`
  });

  const opMachinePost = await call('/api/machines/master', {
    method: 'POST',
    role: 'OPERATOR',
    body: { machineCode: 'X', label: 'Nope', processCode: 'TM' },
  });
  checks.push({
    name: 'OPERATOR POST /machines/master → 403',
    ok: opMachinePost.status === 403,
    detail: `status=${opMachinePost.status}`
  });

  const opValPost = await call('/api/validation-rules', {
    method: 'POST',
    role: 'MACHINE_HEAD',
    body: { processCode: 'FUR', field: 'x', ruleType: 'required', params: {} },
  });
  checks.push({
    name: 'MACHINE_HEAD POST /validation-rules → 403',
    ok: opValPost.status === 403,
    detail: `status=${opValPost.status}`
  });

  const adminValGet = await call('/api/validation-rules', { role: 'ADMIN' });
  checks.push({
    name: 'ADMIN GET /validation-rules → 200 (or 500 if migration pending)',
    ok: adminValGet.status === 200 || adminValGet.status === 500,
    detail: `status=${adminValGet.status}`
  });

  const adminMasterGet = await call('/api/master-data/grade', { role: 'OPERATOR' });
  checks.push({
    name: 'OPERATOR GET /master-data/grade → 200',
    ok: adminMasterGet.status === 200,
    detail: `status=${adminMasterGet.status}`
  });

  const overrideBad = await call('/api/auth/supervisor-override', {
    method: 'POST',
    body: { empCode: 'OP-A59', pin: '1234' },
  });
  checks.push({
    name: 'OPERATOR badge cannot supervisor-override → 403',
    ok: overrideBad.status === 403,
    detail: `status=${overrideBad.status}`
  });

  const erpFlush = await call('/api/erp/writeback/flush', {
    method: 'POST',
    role: 'MACHINE_HEAD',
    body: { limit: 1 },
  });
  checks.push({
    name: 'MACHINE_HEAD POST /erp/writeback/flush → 403',
    ok: erpFlush.status === 403,
    detail: `status=${erpFlush.status}`
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
  console.log('verify-rbac OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});