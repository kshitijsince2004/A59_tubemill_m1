import pg from 'pg';

const base = 'http://localhost:3001/api';
const tenant = '00000000-0000-4000-8000-000000000001';

async function j(method, path, body, role = 'OPERATOR') {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-app-role': role,
      ...(method !== 'GET' ? { 'x-idempotency-key': 'k-' + Date.now() + Math.random() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(method + ' ' + path + ' ' + res.status + ' ' + text.slice(0, 500));
  return data?.data ?? data;
}

const pool = new pg.Pool({ connectionString: 'postgresql://tubemill:tubemill@localhost:5433/tubemill' });
await pool.query(
  `INSERT INTO master.grade (code, tenant_id, label, density_kg_m3)
   VALUES ('NORECIPE', $1, 'No recipe grade', 7850)
   ON CONFLICT DO NOTHING`,
  [tenant]
);
const recipeCheck = await pool.query(
  `SELECT grade_code, furnace_code, ht_type FROM master.fur_zone_recipe
   WHERE tenant_id = $1 AND grade_code = $2`,
  [tenant, 'NORECIPE']
);
console.log('recipes for NORECIPE', recipeCheck.rows);
await pool.end();

const machines = await j('GET', '/furnace/machines');
console.log('1 MACHINES', machines.map((m) => m.machineCode + ':' + m.gasType).join(', '));
if (!['RHF-03', 'RHF-04', 'RHF-05'].every((c) => machines.some((m) => m.machineCode === c))) {
  throw new Error('missing furnaces');
}

const board = await j('GET', '/furnace/board');
console.log(
  'board',
  board.map((b) => [b.furnaceCode, b.runningOrder?.workOrderNo, b.lotStatus])
);

async function freeFurnace(code) {
  const card = board.find((b) => b.furnaceCode === code);
  if (!card?.lotId || !['DRAFT', 'SUBMITTED', 'HOLD'].includes(card.lotStatus)) return;
  await j('PUT', '/furnace/lots/' + card.lotId, {
    disposition: 'ACCEPT',
    htType: card.runningOrder?.htType ?? 'ANNEAL',
    lineSpeedMhr: 20,
    zone1MinC: 800,
    zone1MaxC: 850,
    zone2MinC: 800,
    zone2MaxC: 850,
    zone3MinC: 800,
    zone3MaxC: 850,
    zone4MinC: 800,
    zone4MaxC: 850,
    zone5MinC: 800,
    zone5MaxC: 850,
    zone6MinC: 800,
    zone6MaxC: 850,
  });
  if (card.lotStatus !== 'SUBMITTED') {
    try {
      await j('POST', '/furnace/lots/' + card.lotId + '/submit', {});
    } catch {
      /* may already be ready */
    }
  }
  await j('POST', '/furnace/lots/' + card.lotId + '/approve', {}, 'MACHINE_HEAD');
}

// Ensure RHF-04 free for HT-null assign; keep RHF-03 if already assigned in prior step
const b03 = board.find((b) => b.furnaceCode === 'RHF-03');
let id03 = b03?.lotId;
if (!id03 || !['DRAFT', 'SUBMITTED', 'HOLD'].includes(b03.lotStatus)) {
  await freeFurnace('RHF-03');
  const assign03 = await j('POST', '/furnace/board/RHF-03/assign', {
    workOrderNo: 'WO-CLOSEOUT-03B',
    customerCode: 'TATA',
    gradeCode: '1010',
    size: { odMm: 38.1, thkMm: 2.0, lengthMm: 6000 },
    tubeCount: 10,
  });
  id03 = assign03.id;
  console.log('2 ASSIGN RHF-03', {
    ht: assign03.htType,
    nos: assign03.totalNos,
    mt: assign03.totalMt,
    ds: assign03.dataSource,
  });
  if (assign03.htType !== 'ANNEAL') throw new Error('expected ANNEAL from recipe');
  if (assign03.dataSource !== 'MANUAL') throw new Error('MANUAL');
} else {
  const det = await j('GET', '/furnace/lots/' + id03);
  console.log('2 USING RHF-03', {
    wo: det.workOrderNo,
    ht: det.htType,
    nos: det.totalNos,
    mt: det.totalMt,
    ds: det.dataSource,
  });
  if (det.dataSource !== 'MANUAL') throw new Error('MANUAL');
}

await freeFurnace('RHF-04');
const assign04 = await j('POST', '/furnace/board/RHF-04/assign', {
  workOrderNo: 'WO-CLOSEOUT-04',
  customerCode: 'JINDAL',
  gradeCode: 'NORECIPE',
  size: { odMm: 50, thkMm: 3, lengthMm: 6000 },
  tubeCount: 4,
});
console.log('4 HT no recipe', assign04.htType, '(expect null)');
if (assign04.htType != null) throw new Error('ht should be null got ' + assign04.htType);

const boardIso = await j('GET', '/furnace/board');
const iso03 = boardIso.find((b) => b.furnaceCode === 'RHF-03');
const iso04 = boardIso.find((b) => b.furnaceCode === 'RHF-04');
console.log('3 BOARD isolation', iso03.runningOrder?.workOrderNo, 'vs', iso04.runningOrder?.workOrderNo);
if (iso03.runningOrder?.workOrderNo === iso04.runningOrder?.workOrderNo) {
  throw new Error('isolation fail');
}

const zones = {};
for (let z = 1; z <= 6; z++) {
  zones['zone' + z + 'MinC'] = 880;
  zones['zone' + z + 'MaxC'] = 920;
}
const saved = await j('PUT', '/furnace/lots/' + id03, {
  tubeCount: 12,
  lineSpeedMhr: 22,
  pngA: 1.1,
  pngB: 1.2,
  pngC: 1.3,
  nh3A: 0.4,
  nh3B: 0.5,
  nh3C: 0.6,
  remarks: 'closeout smoke',
  disposition: 'ACCEPT',
  htType: 'ANNEAL',
  size: { odMm: 38.1, thkMm: 2.0, lengthMm: 6000 },
  ...zones,
});
console.log('5 SAVE', {
  nos: saved.totalNos,
  mt: saved.totalMt,
  pngB: saved.pngB,
  ds: saved.dataSource,
});
if (Number(saved.totalNos) !== 12) throw new Error('nos');
if (saved.totalMt == null) throw new Error('mt');
if (saved.dataSource !== 'MANUAL') throw new Error('ds');

if (saved.status === 'DRAFT') {
  await j('POST', '/furnace/lots/' + id03 + '/submit', {});
}
const hist = await j('GET', '/furnace/lots');
const found = hist.find((r) => r.id === id03);
console.log('6 HISTORY', { status: found.status, size: found.size, nos: found.totalNos });

const exportRes = await fetch(base + '/furnace/export', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-app-role': 'OPERATOR',
    'x-idempotency-key': 'e' + Date.now(),
  },
  body: JSON.stringify({
    report: 'ANN-FT-01',
    id: id03,
    supervisor: 'Closeout Op',
    incharge: 'Closeout Op',
  }),
});
const buf = Buffer.from(await exportRes.arrayBuffer());
console.log('7 EXPORT', exportRes.status, buf.length);
if (!exportRes.ok || buf.length < 800) throw new Error('export');

const csv = await (
  await fetch(base + '/furnace/lots/' + id03 + '/export?format=csv', {
    headers: { 'x-app-role': 'OPERATOR' },
  })
).text();
if (!csv.includes('pngA') || !csv.includes('1.1') || !csv.includes('nh3C')) throw new Error('csv');
console.log('8 CSV ABC ok');

const mtNull = await j('PUT', '/furnace/lots/' + assign04.id, {
  size: {},
  tubeCount: 4,
  htType: 'NORMALIZE',
  lineSpeedMhr: 18,
  ...zones,
});
console.log('9 MT without size', mtNull.totalMt);
if (mtNull.totalMt != null) throw new Error('invented mt');

console.log('ACCEPTANCE_OK');
