/**
 * Machine Head profile smoke (AUTH_ALLOW_HEADER_ROLE=true, seeded DB, server running).
 * Usage: npm run smoke:machine-head -w server
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

  const dash = await call('/api/reports/machine-head', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'MH dashboard',
    ok: dash.status === 200 && dash.json?.data?.byProcess,
    detail: `status=${dash.status}`,
  });

  const pending = await call('/api/reports/machine-head/pending', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'MH pending queue',
    ok: pending.status === 200 && Array.isArray(pending.json?.data?.items),
    detail: `status=${pending.status}`,
  });

  const quality = await call('/api/quality/specs', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'quality specs',
    ok: quality.status === 200,
    detail: `status=${quality.status}`,
  });

  const crew = await call('/api/machine-head/crew', { role: 'MACHINE_HEAD' });
  checks.push({
    name: 'crew list',
    ok: crew.status === 200,
    detail: `status=${crew.status}`,
  });

  const override = await call('/api/auth/supervisor-override', {
    method: 'POST',
    body: { empCode: 'MH-01', pin: '1234' },
  });
  checks.push({
    name: 'supervisor-override with MH PIN',
    ok: override.status === 200 && override.json?.data?.ok,
    detail: `status=${override.status}`,
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
  console.log('smoke:machine-head OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
