/**
 * API inventory probe — GET endpoints (+ a few key POSTs) with x-app-role: ADMIN.
 * Usage (server running, AUTH_ALLOW_HEADER_ROLE=true, seeded DB):
 *   npm run smoke:api-inventory -w server
 *
 * Optional: LABEL=before|after node dist/smoke-api-inventory.js
 */
import { config } from './config';

const base = `http://127.0.0.1:${config.port}`;
const label = process.env.LABEL || 'probe';

const ENDPOINTS = [
  { group: 'health', method: 'GET', path: '/api/health' },
  { group: 'auth', method: 'GET', path: '/api/auth/me' },

  { group: 'erp', method: 'GET', path: '/api/erp/health' },
  { group: 'erp', method: 'GET', path: '/api/erp/watermarks' },
  { group: 'erp', method: 'GET', path: '/api/erp/orders?status=Released' },

  { group: 'tm', method: 'GET', path: '/api/tubemill/session' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/queue?mill=A-59' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/runs?mill=A-59' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/live-status?mill=A-59' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/stoppage-codes' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/defect-codes' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/consumables' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/param-chart' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/shifts?mill=A-59' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/params?mill=A-59' },
  { group: 'tm', method: 'GET', path: '/api/tubemill/setups?mill=A-59' },

  { group: 'fur', method: 'GET', path: '/api/furnace/machines' },
  { group: 'fur', method: 'GET', path: '/api/furnace/board' },
  { group: 'fur', method: 'GET', path: '/api/furnace/lots' },
  { group: 'fur', method: 'GET', path: '/api/furnace/stoppages/open' },
  { group: 'fur', method: 'GET', path: '/api/furnace/stoppages' },
  { group: 'fur', method: 'GET', path: '/api/furnace/gas-logs' },
  { group: 'fur', method: 'GET', path: '/api/furnace/consumption?furnaceCode=RHF-03&prodDate=2026-09-23' },
  { group: 'fur', method: 'GET', path: '/api/furnace/recipes?gradeCode=1010&furnaceCode=RHF-03' },
  { group: 'fur', method: 'GET', path: '/api/furnace/reports' },
  { group: 'fur', method: 'GET', path: '/api/furnace/session' },

  { group: 'stp', method: 'GET', path: '/api/stp/orders?status=Released' },
  { group: 'stp', method: 'GET', path: '/api/stp/live-status' },
  { group: 'stp', method: 'GET', path: '/api/stp/lots' },
  { group: 'stp', method: 'GET', path: '/api/stp/bath-history' },
  { group: 'stp', method: 'GET', path: '/api/stp/bath-specs' },
  { group: 'stp', method: 'GET', path: '/api/stp/history/bath-analysis' },
  { group: 'stp', method: 'GET', path: '/api/stp/history/chemical' },
  { group: 'stp', method: 'GET', path: '/api/stp/history/stoppages' },
  { group: 'stp', method: 'GET', path: '/api/stp/reports' },
  { group: 'stp', method: 'GET', path: '/api/stp/session' },

  { group: 'drw', method: 'GET', path: '/api/drawbench/machines' },
  { group: 'drw', method: 'GET', path: '/api/drawbench/board' },
  { group: 'drw', method: 'GET', path: '/api/drawbench/tooling' },
  { group: 'drw', method: 'GET', path: '/api/drawbench/lots' },
  { group: 'drw', method: 'GET', path: '/api/drawbench/paint-colour?grade=1010' },
  { group: 'drw', method: 'GET', path: '/api/drawbench/benches/suggest?od=38.1&thk=2' },
  { group: 'drw', method: 'GET', path: '/api/drawbench/reports' },
  { group: 'drw', method: 'GET', path: '/api/drawbench/session' },

  { group: 'swg', method: 'GET', path: '/api/swage/machines' },
  { group: 'swg', method: 'GET', path: '/api/swage/lots' },

  { group: 'genealogy', method: 'GET', path: '/api/genealogy/upstream?process=DRW' },
  { group: 'genealogy', method: 'GET', path: '/api/stoppages/codes?process=FUR' },

  { group: 'admin', method: 'GET', path: '/api/users' },
  { group: 'admin', method: 'GET', path: '/api/machines/master' },
  { group: 'admin', method: 'GET', path: '/api/master-data' },
  { group: 'admin', method: 'GET', path: '/api/master-data/stoppage_code' },
  { group: 'admin', method: 'GET', path: '/api/validation-rules' },
  { group: 'admin', method: 'GET', path: '/api/validation-rules/version' },
  { group: 'admin', method: 'GET', path: '/api/quality/specs' },

  { group: 'crew', method: 'GET', path: '/api/machine-head/crew?machineCode=A-59' },

  { group: 'reports', method: 'GET', path: '/api/reports/plant-head' },
  { group: 'reports', method: 'GET', path: '/api/reports/plant-head/backlog' },
  { group: 'reports', method: 'GET', path: '/api/reports/management?period=7d' },
  { group: 'reports', method: 'GET', path: '/api/reports/drilldown' },
  { group: 'reports', method: 'GET', path: '/api/reports/daily' },
  { group: 'reports', method: 'GET', path: '/api/reports/production' },
  { group: 'reports', method: 'GET', path: '/api/reports/defects' },
  { group: 'reports', method: 'GET', path: '/api/reports/downtime' },
  { group: 'reports', method: 'GET', path: '/api/reports/orders' },
  { group: 'reports', method: 'GET', path: '/api/reports/machine-head' },
  { group: 'reports', method: 'GET', path: '/api/reports/machine-head/pending' },
  { group: 'reports', method: 'GET', path: '/api/audit?limit=50' },
  { group: 'reports', method: 'GET', path: '/api/plant/exports/reports' },
  { group: 'reports', method: 'GET', path: '/api/plant/exports/history' },
];

function summarizeData(data) {
  if (data == null) return { kind: 'null', count: 0, populated: false };
  if (Array.isArray(data)) {
    return { kind: 'array', count: data.length, populated: data.length > 0 };
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    const nestedArrays = keys.filter((k) => Array.isArray(data[k]));
    const nestedCount = nestedArrays.reduce((n, k) => n + data[k].length, 0);
    const populated =
      nestedArrays.length > 0
        ? nestedCount > 0 || keys.some((k) => data[k] != null && !Array.isArray(data[k]) && data[k] !== '')
        : keys.length > 0;
    return {
      kind: 'object',
      count: nestedArrays.length ? nestedCount : keys.length,
      populated,
      keys: keys.slice(0, 8).join(','),
    };
  }
  return { kind: typeof data, count: 1, populated: Boolean(data) };
}

async function call(ep) {
  const headers = {
    'Content-Type': 'application/json',
    'st-auth-mode': 'header',
    'x-app-role': 'ADMIN',
  };
  let res;
  try {
    res = await fetch(`${base}${ep.path}`, {
      method: ep.method,
      headers,
      body: ep.body ? JSON.stringify(ep.body) : undefined,
    });
  } catch (e) {
    return {
      group: ep.group,
      method: ep.method,
      path: ep.path,
      status: 0,
      ok: false,
      populated: false,
      count: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const json = await res.json().catch(() => ({}));
  const summary = summarizeData(json?.data);
  return {
    group: ep.group,
    method: ep.method,
    path: ep.path,
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    populated: summary.populated,
    count: summary.count,
    kind: summary.kind,
    keys: summary.keys,
    err: json?.errors?.[0]?.message,
  };
}

async function main() {
  if (!config.allowHeaderRole) {
    console.error('Set AUTH_ALLOW_HEADER_ROLE=true for header-based inventory');
    process.exit(1);
  }

  console.log(`\n=== API inventory (${label}) @ ${base} ===\n`);

  const rows = [];
  for (const ep of ENDPOINTS) {
    rows.push(await call(ep));
    await new Promise((r) => setTimeout(r, 40));
  }

  const byGroup = {};
  for (const r of rows) {
    if (!byGroup[r.group]) byGroup[r.group] = [];
    byGroup[r.group].push(r);
  }

  for (const [group, list] of Object.entries(byGroup)) {
    console.log(`--- ${group} ---`);
    for (const r of list) {
      const flag = !r.ok ? 'FAIL' : r.populated ? 'POP' : 'EMPTY';
      const extra = r.error || r.err || (r.keys ? `keys=${r.keys}` : '');
      console.log(
        `  [${flag}] ${r.status} n=${r.count} ${r.method} ${r.path}${extra ? `  (${extra})` : ''}`
      );
    }
    console.log('');
  }

  const ok = rows.filter((r) => r.ok).length;
  const pop = rows.filter((r) => r.ok && r.populated).length;
  const empty = rows.filter((r) => r.ok && !r.populated).length;
  const fail = rows.filter((r) => !r.ok).length;

  console.log(
    `SUMMARY (${label}): total=${rows.length} ok=${ok} populated=${pop} empty=${empty} fail=${fail}`
  );

  // Machine-readable line for before/after compare
  console.log(
    `JSON_SUMMARY ${JSON.stringify({
      label,
      total: rows.length,
      ok,
      populated: pop,
      empty,
      fail,
      emptyPaths: rows.filter((r) => r.ok && !r.populated).map((r) => r.path),
      failPaths: rows.filter((r) => !r.ok).map((r) => `${r.status} ${r.path}`),
      erpOrders: rows.find((r) => r.path.includes('/erp/orders'))?.count ?? null,
      watermarks: rows.find((r) => r.path.includes('/erp/watermarks'))?.count ?? null,
    })}`
  );

  if (fail > 0 && rows.every((r) => r.status === 0)) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
