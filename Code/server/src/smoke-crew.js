/**
 * Crew engine smoke (AUTH_ALLOW_HEADER_ROLE=true, migrated+seeded DB, server running).
 * Usage: npm run smoke:crew -w server
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
  const mill = 'A-59';

  const list = await call(`/api/machine-head/crew?machineCode=${encodeURIComponent(mill)}`, {
    role: 'ADMIN',
  });
  const items = list.json?.data?.items ?? [];
  checks.push({
    name: 'ADMIN roster list',
    ok: list.status === 200 && Array.isArray(items) && items.length > 0,
    detail: `status=${list.status} n=${items.length}`,
  });

  const mhList = await call(`/api/machine-head/crew?machineCode=${encodeURIComponent(mill)}`, {
    role: 'MACHINE_HEAD',
  });
  checks.push({
    name: 'MH roster list',
    ok: mhList.status === 200,
    detail: `status=${mhList.status}`,
  });

  const opList = await call(`/api/machine-head/crew?machineCode=${encodeURIComponent(mill)}`, {
    role: 'OPERATOR',
  });
  checks.push({
    name: 'OPERATOR roster read',
    ok: opList.status === 200 || opList.status === 403,
    detail: `status=${opList.status}`,
  });

  const session = await call(`/api/machines/${encodeURIComponent(mill)}/session`, {
    method: 'POST',
    role: 'ADMIN',
    body: { shiftCode: 'A' },
  });
  const sessionId = session.json?.data?.session?.sessionId ?? session.json?.data?.session?.id;
  const needsCrew = session.json?.data?.needsCrew;
  checks.push({
    name: 'ensureActiveSession',
    ok: session.status === 200 && sessionId,
    detail: `status=${session.status} needsCrew=${needsCrew} id=${sessionId}`,
  });

  const crewIds = items.slice(0, 2).map((r) => r.id ?? r.crewId).filter(Boolean);
  if (sessionId && crewIds.length) {
    const attach1 = await call('/api/crew/attach', {
      method: 'POST',
      role: 'ADMIN',
      body: { sessionId, crewIds },
    });
    const attach2 = await call('/api/crew/attach', {
      method: 'POST',
      role: 'ADMIN',
      body: { sessionId, crewIds },
    });
    const n1 = (attach1.json?.data?.items ?? []).length;
    const n2 = (attach2.json?.data?.items ?? []).length;
    checks.push({
      name: 'attach idempotent',
      ok: attach1.status === 200 && attach2.status === 200 && n1 === n2 && n1 > 0,
      detail: `n1=${n1} n2=${n2}`,
    });

    const listed = await call(`/api/crew?sessionId=${encodeURIComponent(sessionId)}`, {
      role: 'ADMIN',
    });
    checks.push({
      name: 'list session crew',
      ok: listed.status === 200 && (listed.json?.data?.items ?? []).length > 0,
      detail: `status=${listed.status}`,
    });
  } else {
    checks.push({
      name: 'attach idempotent',
      ok: false,
      detail: 'skipped — no session or roster',
    });
  }

  const resume = await call(`/api/machines/${encodeURIComponent(mill)}/session`, {
    method: 'POST',
    role: 'ADMIN',
    body: { shiftCode: 'A' },
  });
  checks.push({
    name: 'resume needsCrew false after attach',
    ok: resume.status === 200 && resume.json?.data?.needsCrew === false,
    detail: `needsCrew=${resume.json?.data?.needsCrew}`,
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
  console.log('smoke:crew OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
