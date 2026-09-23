const base = 'http://127.0.0.1:3001/api';

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
  return { ok: res.ok, status: res.status, data: data?.data ?? data, errors: data?.errors };
}

async function free(code) {
  const board = await j('GET', '/furnace/board');
  const b = (board.data ?? []).find((x) => x.furnaceCode === code);
  if (!b?.lotId) return;
  if (['DRAFT', 'SUBMITTED', 'HOLD'].includes(b.lotStatus) && !b.productionEndedAt) {
    if (!b.productionStartedAt) {
      await j('POST', `/furnace/lots/${b.lotId}/start`, {});
    }
    await j('POST', `/furnace/lots/${b.lotId}/end`, {});
  }
}

async function main() {
  // RBAC: operator denied hold/export/approve
  const board0 = await j('GET', '/furnace/board');
  const anyLot = (board0.data ?? []).find((b) => b.lotId)?.lotId;
  if (anyLot) {
    const hold = await j('POST', `/furnace/lots/${anyLot}/hold`, {}, 'OPERATOR');
    const exp = await j('POST', '/furnace/export', { report: 'ANN-FT-01', id: anyLot }, 'OPERATOR');
    const appr = await j('POST', `/furnace/lots/${anyLot}/approve`, {}, 'OPERATOR');
    console.log('RBAC hold', hold.status, 'export', exp.status, 'approve', appr.status);
    if (hold.status !== 403 && hold.ok) throw new Error('OPERATOR must not hold');
    if (exp.status !== 403 && exp.ok) throw new Error('OPERATOR must not export');
    if (appr.status !== 403 && appr.ok) throw new Error('OPERATOR must not approve');
  }

  await free('RHF-05');
  const assign = await j('POST', '/furnace/board/RHF-05/assign', {
    workOrderNo: 'WO-WF-05',
    customerCode: 'TATA',
    gradeCode: '1010',
    size: { odMm: 38.1, thkMm: 2, lengthMm: 6000 },
    tubeCount: 10,
    htType: 'ANNEAL',
  });
  if (!assign.ok) throw new Error('assign ' + JSON.stringify(assign.errors));
  const id = assign.data.id;
  console.log('assign', assign.data.chargeNo, 'started', assign.data.productionStartedAt);

  let board = await j('GET', '/furnace/board');
  let card = board.data.find((b) => b.furnaceCode === 'RHF-05');
  console.log('status after assign', card.status);
  if (card.status !== 'PREPARING') throw new Error('expected PREPARING got ' + card.status);

  const start = await j('POST', `/furnace/lots/${id}/start`, {});
  if (!start.ok) throw new Error('start ' + JSON.stringify(start.errors));
  board = await j('GET', '/furnace/board');
  card = board.data.find((b) => b.furnaceCode === 'RHF-05');
  console.log('status after start', card.status, start.data.productionStartedAt);
  if (card.status !== 'RUNNING') throw new Error('expected RUNNING');

  const zones = {};
  for (let z = 1; z <= 6; z++) {
    zones[`zone${z}MinC`] = 890;
    zones[`zone${z}MaxC`] = 910;
  }
  const save = await j('PUT', `/furnace/lots/${id}`, {
    tubeCount: 12,
    lineSpeedMhr: 22,
    htType: 'ANNEAL',
    disposition: 'ACCEPT',
    size: { odMm: 38.1, thkMm: 2, lengthMm: 6000 },
    ...zones,
  });
  if (!save.ok) throw new Error('save ' + JSON.stringify(save.errors));

  const codes = await j('GET', '/stoppages/codes?process=FUR');
  const code = codes.data?.[0]?.code ?? codes.data?.[0] ?? 'FUR-01';
  const openStop = await j('POST', '/stoppages/open', {
    processCode: 'FUR',
    sourceId: id,
    millCode: 'RHF-05',
    stoppageCode: typeof code === 'string' ? code : String(code),
    reason: 'workflow smoke',
  });
  if (!openStop.ok) throw new Error('stoppage open ' + JSON.stringify(openStop.errors));
  board = await j('GET', '/furnace/board');
  card = board.data.find((b) => b.furnaceCode === 'RHF-05');
  console.log('status after stoppage', card.status);
  if (card.status !== 'STOPPAGE') throw new Error('expected STOPPAGE');

  const closeStop = await j('POST', '/stoppages/close', { processCode: 'FUR', sourceId: id });
  if (!closeStop.ok) throw new Error('stoppage close');
  board = await j('GET', '/furnace/board');
  card = board.data.find((b) => b.furnaceCode === 'RHF-05');
  console.log('status after end stoppage', card.status);
  if (card.status !== 'RUNNING') throw new Error('expected RUNNING after end stoppage');

  const end = await j('POST', `/furnace/lots/${id}/end`, {});
  if (!end.ok) throw new Error('end ' + JSON.stringify(end.errors));
  board = await j('GET', '/furnace/board');
  card = board.data.find((b) => b.furnaceCode === 'RHF-05');
  console.log('status after end', card.status);
  if (card.status !== 'COMPLETE' && card.status !== 'IDLE') {
    // if next active lot none and ended preferred out, COMPLETE or IDLE
    console.log('card', card);
  }
  if (card.lotId === id && card.status !== 'COMPLETE') throw new Error('expected COMPLETE for ended lot');

  const submit = await j('POST', `/furnace/lots/${id}/submit`, {});
  if (!submit.ok) throw new Error('submit ' + JSON.stringify(submit.errors));

  const expSup = await j('POST', '/furnace/export', { report: 'ANN-FT-01', id }, 'MACHINE_HEAD');
  console.log('supervisor export', expSup.status, expSup.ok);

  console.log('WORKFLOW_SMOKE_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
