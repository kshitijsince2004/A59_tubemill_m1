import { query } from '../db/pool';
import { config } from '../config';

const TENANT = () => config.tenantId;

async function safeQuery(sql, params, fallback = []) {
  try {
    return await query(sql, params);
  } catch {
    return fallback;
  }
}

class TraceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TraceNotFoundError';
    this.code = 'TRACE_NOT_FOUND';
  }
}

function sizeLabel(size) {
  if (!size) return null;
  const s = typeof size === 'string' ? (() => { try { return JSON.parse(size); } catch { return null; } })() : size;
  if (!s || typeof s !== 'object') return null;
  const parts = [s.odMm ?? s.od, s.thkMm ?? s.thk, s.lenMm ?? s.len].filter((v) => v != null && v !== '');
  return parts.length ? parts.join(' × ') : null;
}

/**
 * Resolve identity candidates from A59 spine tables.
 * @param {string} q
 */
async function resolveCandidates(q) {
  const tenant = TENANT();
  const pattern = q;

  const lots = await safeQuery(
    `SELECT ml.id, ml.lot_tag, ml.coil_tag, ml.work_order_no, ml.customer_code, ml.grade_code, ml.size,
            ml.status, ml.current_process, ml.origin_process, ml.origin_record_id, ml.updated_at
     FROM txn.material_lot ml
     LEFT JOIN master.customer cu ON cu.code = ml.customer_code AND cu.tenant_id = ml.tenant_id
     WHERE ml.tenant_id = $1
       AND (
         ml.lot_tag ILIKE $2 OR ml.coil_tag ILIKE $2 OR ml.work_order_no ILIKE $2
         OR ml.customer_code ILIKE $2 OR cu.name ILIKE $2
       )
     ORDER BY ml.updated_at DESC NULLS LAST
     LIMIT 20`,
    [tenant, pattern]
  );

  const tmRuns = await safeQuery(
    `SELECT r.id, r.run_no, r.mill_code, r.work_order_no, r.bc_batch_number, r.customer_code,
            r.grade_code, r.size, r.status, r.raw_material_mt, r.total_prime_mt, r.yield_pct,
            r.created_at, c.coil_tag
     FROM txn.prod_tm_run r
     LEFT JOIN txn.prod_tm_coil_input c ON c.run_id = r.id AND c.tenant_id = r.tenant_id
     LEFT JOIN master.customer cu ON cu.code = r.customer_code AND cu.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1
       AND (
         r.work_order_no ILIKE $2 OR r.bc_batch_number ILIKE $2 OR r.run_no ILIKE $2
         OR c.coil_tag ILIKE $2 OR r.customer_code ILIKE $2 OR cu.name ILIKE $2
       )
     ORDER BY r.created_at DESC NULLS LAST
     LIMIT 20`,
    [tenant, pattern]
  );

  let erpOrders = await safeQuery(
    `SELECT o.work_order_no, o.status, o.customer_code, o.grade_code, o.lot_no, o.size,
            o.qty_pieces, o.planned_qty, o.mill_code,
            l.coil_no, l.lot_no AS line_lot_no, l.next_process, l.line_no
     FROM erp.released_order o
     LEFT JOIN erp.released_order_line l
       ON l.tenant_id = o.tenant_id AND l.work_order_no = o.work_order_no
     LEFT JOIN master.customer cu ON cu.code = o.customer_code AND cu.tenant_id = o.tenant_id
     WHERE o.tenant_id = $1
       AND (
         o.work_order_no ILIKE $2 OR o.lot_no ILIKE $2
         OR l.coil_no ILIKE $2 OR l.lot_no ILIKE $2
         OR o.customer_code ILIKE $2 OR cu.name ILIKE $2
       )
     ORDER BY o.updated_at DESC NULLS LAST
     LIMIT 20`,
    [tenant, pattern]
  );
  if (!erpOrders.length) {
    erpOrders = await safeQuery(
      `SELECT o.work_order_no, o.status, o.customer_code, o.grade_code, o.lot_no, o.size,
              o.qty_pieces, o.planned_qty, o.mill_code,
              NULL::text AS coil_no, NULL::text AS line_lot_no,
              NULL::text AS next_process, NULL::int AS line_no
       FROM erp.released_order o
       LEFT JOIN master.customer cu ON cu.code = o.customer_code AND cu.tenant_id = o.tenant_id
       WHERE o.tenant_id = $1
         AND (
           o.work_order_no ILIKE $2 OR o.lot_no ILIKE $2
           OR o.customer_code ILIKE $2 OR cu.name ILIKE $2
         )
       ORDER BY o.updated_at DESC NULLS LAST
       LIMIT 20`,
      [tenant, pattern]
    );
  }

  const queueCards = await safeQuery(
    `SELECT q.work_order_no, q.bc_batch_number, q.customer_code, q.grade_code, q.size, q.status, q.mill_code, q.lot_no
     FROM ops.queue_card q
     LEFT JOIN master.customer cu ON cu.code = q.customer_code AND cu.tenant_id = q.tenant_id
     WHERE q.tenant_id = $1
       AND (
         q.work_order_no ILIKE $2 OR q.bc_batch_number ILIKE $2 OR q.lot_no ILIKE $2
         OR q.customer_code ILIKE $2 OR cu.name ILIKE $2
       )
     ORDER BY q.id DESC
     LIMIT 10`,
    [tenant, pattern]
  );

  return { lots, tmRuns, erpOrders, queueCards };
}

function pickPrimary({ lots, tmRuns, erpOrders, queueCards }, q) {
  if (lots.length) return { kind: 'lot', row: lots[0] };
  if (tmRuns.length) return { kind: 'tm', row: tmRuns[0] };
  if (erpOrders.length) return { kind: 'erp', row: erpOrders[0] };
  if (queueCards.length) return { kind: 'queue', row: queueCards[0] };
  return null;
}

function buildOrderInfo(primary, extras) {
  if (!primary) return null;
  const { kind, row } = primary;
  const erp = extras.erpOrders[0] ?? null;
  const queue = extras.queueCards[0] ?? null;
  const lot = kind === 'lot' ? row : extras.lots[0] ?? null;
  const tm = kind === 'tm' ? row : extras.tmRuns[0] ?? null;

  const batchNumber =
    tm?.bc_batch_number ??
    queue?.bc_batch_number ??
    lot?.lot_tag ??
    null;
  const coilNo =
    lot?.coil_tag ??
    lot?.lot_tag ??
    tm?.coil_tag ??
    erp?.coil_no ??
    null;
  const workOrderNo =
    lot?.work_order_no ?? tm?.work_order_no ?? erp?.work_order_no ?? queue?.work_order_no ?? null;

  return {
    batchNumber,
    coilNo,
    motherCoil: coilNo,
    slitId: lot?.lot_tag && lot?.coil_tag && lot.lot_tag !== lot.coil_tag ? lot.lot_tag : null,
    sapOrderNo: workOrderNo,
    workOrderNo,
    customer: lot?.customer_code ?? tm?.customer_code ?? erp?.customer_code ?? queue?.customer_code ?? null,
    grade: lot?.grade_code ?? tm?.grade_code ?? erp?.grade_code ?? queue?.grade_code ?? null,
    status: lot?.status ?? erp?.status ?? tm?.status ?? queue?.status ?? 'PENDING',
    subProcess: lot?.current_process ?? erp?.next_process ?? null,
    machine: tm?.mill_code ?? erp?.mill_code ?? queue?.mill_code ?? null,
    allocated: Boolean(lot || tm),
    planDate: null,
    shift: null,
    weightMt:
      tm?.total_prime_mt != null
        ? Number(tm.total_prime_mt)
        : erp?.planned_qty != null
          ? Number(erp.planned_qty)
          : null,
    targetThickness: null,
    inputThickness: null,
    size: sizeLabel(lot?.size ?? tm?.size ?? erp?.size ?? queue?.size),
  };
}

async function loadHandoffs(lotIds) {
  if (!lotIds.length) return [];
  return safeQuery(
    `SELECT h.id, h.material_lot_id, h.from_process, h.to_process, h.handed_at,
            h.from_record_id, h.to_record_id, h.notes
     FROM txn.process_handoff h
     WHERE h.tenant_id = $1 AND h.material_lot_id = ANY($2::uuid[])
     ORDER BY h.handed_at ASC`,
    [TENANT(), lotIds]
  );
}

function buildMachineJourney(handoffs) {
  return handoffs.map((h, i) => ({
    step: i + 1,
    process: h.to_process ? `${h.from_process} → ${h.to_process}` : h.from_process,
    machine: null,
    status: h.to_process ? 'COMPLETED' : 'ACTIVE',
    completedAt: h.handed_at ?? null,
  }));
}

function buildLineage(lot, handoffs) {
  const tags = [];
  if (lot?.lot_tag) tags.push(String(lot.lot_tag));
  if (lot?.coil_tag && lot.coil_tag !== lot.lot_tag) tags.push(String(lot.coil_tag));
  for (const h of handoffs) {
    const label = h.to_process || h.from_process;
    if (label && !tags.includes(label)) tags.push(label);
  }
  if (lot?.current_process && !tags.includes(lot.current_process)) {
    tags.push(lot.current_process);
  }
  return tags;
}

async function loadHistory({ lot, workOrderNo, coilTag }) {
  const tenant = TENANT();
  const history = [];
  const wo = workOrderNo || null;
  const coil = coilTag || lot?.coil_tag || lot?.lot_tag || null;
  const lotId = lot?.id || null;

  const tmRows = await safeQuery(
    `SELECT r.id, r.run_no, r.mill_code, r.work_order_no, r.bc_batch_number, r.customer_code,
            r.grade_code, r.status, r.raw_material_mt, r.total_prime_mt, r.total_scrap_mt,
            r.yield_pct, r.created_at, c.coil_tag
     FROM txn.prod_tm_run r
     LEFT JOIN txn.prod_tm_coil_input c ON c.run_id = r.id AND c.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1
       AND (
         ($2::text IS NOT NULL AND r.work_order_no = $2)
         OR ($3::text IS NOT NULL AND c.coil_tag = $3)
         OR ($3::text IS NOT NULL AND r.run_no = $3)
       )
     ORDER BY r.created_at DESC NULLS LAST
     LIMIT 10`,
    [tenant, wo, coil]
  );
  for (const r of tmRows) {
    history.push({
      process: 'TM',
      coilNo: r.coil_tag || coil || null,
      record: {
        runNo: r.run_no,
        mill: r.mill_code,
        workOrderNo: r.work_order_no,
        batch: r.bc_batch_number,
        customer: r.customer_code,
        grade: r.grade_code,
        status: r.status,
        rawMt: r.raw_material_mt != null ? Number(r.raw_material_mt) : null,
        primeMt: r.total_prime_mt != null ? Number(r.total_prime_mt) : null,
        scrapMt: r.total_scrap_mt != null ? Number(r.total_scrap_mt) : null,
        yieldPct: r.yield_pct != null ? Number(r.yield_pct) : null,
        at: r.created_at,
      },
    });
  }

  const furRows = await safeQuery(
    `SELECT id, charge_no, furnace_code, work_order_no, customer_code, grade_code, status,
            ht_type, total_nos, total_mt, qty_nos, qty_mt, line_speed_mhr, prod_date,
            zone3_min_c, zone3_max_c, material_lot_id, created_at
     FROM txn.prod_ann_run
     WHERE tenant_id = $1
       AND (
         ($2::text IS NOT NULL AND work_order_no = $2)
         OR ($3::uuid IS NOT NULL AND material_lot_id = $3)
         OR ($4::text IS NOT NULL AND charge_no ILIKE $4)
       )
     ORDER BY created_at DESC NULLS LAST
     LIMIT 10`,
    [tenant, wo, lotId, coil ? `%${coil}%` : null]
  );
  for (const r of furRows) {
    const siblings = [];
    if (r.charge_no) {
      const sibLots = await safeQuery(
        `SELECT DISTINCT ml.lot_tag
         FROM txn.prod_ann_run a
         JOIN txn.material_lot ml ON ml.id = a.material_lot_id
         WHERE a.tenant_id = $1 AND a.charge_no = $2 AND ml.lot_tag IS NOT NULL
         LIMIT 20`,
        [tenant, r.charge_no]
      );
      for (const s of sibLots) {
        if (s.lot_tag) siblings.push(String(s.lot_tag));
      }
    }
    history.push({
      process: 'FUR',
      coilNo: coil || null,
      record: {
        chargeNo: r.charge_no,
        furnace: r.furnace_code,
        workOrderNo: r.work_order_no,
        customer: r.customer_code,
        grade: r.grade_code,
        status: r.status,
        htType: r.ht_type,
        qtyNos: r.qty_nos ?? r.total_nos,
        qtyMt: r.qty_mt != null ? Number(r.qty_mt) : r.total_mt != null ? Number(r.total_mt) : null,
        lineSpeed: r.line_speed_mhr != null ? Number(r.line_speed_mhr) : null,
        soakMinC: r.zone3_min_c != null ? Number(r.zone3_min_c) : null,
        soakMaxC: r.zone3_max_c != null ? Number(r.zone3_max_c) : null,
        prodDate: r.prod_date,
      },
      siblings: siblings.length ? siblings : undefined,
    });
  }

  const stpRows = await safeQuery(
    `SELECT id, lot_no, work_order_no, customer_code, grade_code, machine_code, status,
            qty_no, qty_mt, surface_finish, pickle_time_min, prod_date, material_lot_id, created_at
     FROM txn.prod_stp_lot
     WHERE tenant_id = $1
       AND (
         ($2::text IS NOT NULL AND work_order_no = $2)
         OR ($3::uuid IS NOT NULL AND material_lot_id = $3)
         OR ($4::text IS NOT NULL AND lot_no ILIKE $4)
       )
     ORDER BY created_at DESC NULLS LAST
     LIMIT 10`,
    [tenant, wo, lotId, coil ? `%${coil}%` : null]
  );
  for (const r of stpRows) {
    history.push({
      process: 'STP',
      coilNo: r.lot_no || coil || null,
      record: {
        lotNo: r.lot_no,
        workOrderNo: r.work_order_no,
        customer: r.customer_code,
        grade: r.grade_code,
        machine: r.machine_code,
        status: r.status,
        qtyNos: r.qty_no,
        qtyMt: r.qty_mt != null ? Number(r.qty_mt) : null,
        surfaceFinish: r.surface_finish,
        pickleTimeMin: r.pickle_time_min != null ? Number(r.pickle_time_min) : null,
        prodDate: r.prod_date,
      },
    });
  }

  const dbRows = await safeQuery(
    `SELECT id, lot_no, work_order_no, customer_code, grade_code, bench_code, status,
            draw_pass, pass_type, stage, accepted_pcs, rejected_pcs, drawn_metre,
            pull_load_t, tag_no, prod_date, material_lot_id, created_at
     FROM txn.prod_db_lot
     WHERE tenant_id = $1
       AND (
         ($2::text IS NOT NULL AND work_order_no = $2)
         OR ($3::uuid IS NOT NULL AND material_lot_id = $3)
         OR ($4::text IS NOT NULL AND (lot_no ILIKE $4 OR tag_no ILIKE $4 OR input_tube_ref ILIKE $4))
       )
     ORDER BY created_at DESC NULLS LAST
     LIMIT 10`,
    [tenant, wo, lotId, coil ? `%${coil}%` : null]
  );
  for (const r of dbRows) {
    history.push({
      process: 'DRW',
      coilNo: r.tag_no || r.lot_no || coil || null,
      record: {
        lotNo: r.lot_no,
        tagNo: r.tag_no,
        workOrderNo: r.work_order_no,
        customer: r.customer_code,
        grade: r.grade_code,
        bench: r.bench_code,
        status: r.status,
        drawPass: r.draw_pass ?? r.pass_type,
        stage: r.stage,
        acceptedPcs: r.accepted_pcs,
        rejectedPcs: r.rejected_pcs,
        drawnMetre: r.drawn_metre != null ? Number(r.drawn_metre) : null,
        pullLoadT: r.pull_load_t != null ? Number(r.pull_load_t) : null,
        prodDate: r.prod_date,
      },
    });
  }

  return history;
}

/**
 * Full-query Postgres trace (system of record).
 * @param {string} qRaw
 * @param {{ searchedBy?: string }} [opts]
 */
export async function search(qRaw, opts = {}) {
  const q = String(qRaw || '').trim();
  if (!q) {
    const err = new Error('Missing q');
    err.code = 'MISSING_Q';
    throw err;
  }

  const pattern = q.includes('%') ? q : `%${q}%`;
  const candidates = await resolveCandidates(pattern);
  const primary = pickPrimary(candidates, q);

  if (!primary) {
    throw new TraceNotFoundError(`No trace found for "${q}"`);
  }

  const lot =
    primary.kind === 'lot'
      ? primary.row
      : candidates.lots[0] ?? null;

  // If we only matched TM/ERP, try to find linked lot by WO or coil
  let resolvedLot = lot;
  if (!resolvedLot) {
    const wo = primary.row.work_order_no ?? null;
    const coil = primary.row.coil_tag ?? primary.row.coil_no ?? null;
    if (wo || coil) {
      const linked = await query(
        `SELECT * FROM txn.material_lot
         WHERE tenant_id = $1
           AND (
             ($2::text IS NOT NULL AND work_order_no = $2)
             OR ($3::text IS NOT NULL AND (lot_tag = $3 OR coil_tag = $3))
           )
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1`,
        [TENANT(), wo, coil]
      );
      resolvedLot = linked[0] ?? null;
    }
  }

  const lotIds = resolvedLot ? [resolvedLot.id] : candidates.lots.map((l) => l.id);
  const handoffs = await loadHandoffs(lotIds);
  const orderInfo = buildOrderInfo(primary, candidates);
  const machineJourney = buildMachineJourney(handoffs);

  // If no handoffs, synthesize a soft journey from known process presence
  if (!machineJourney.length && resolvedLot?.current_process) {
    const origin = resolvedLot.origin_process || 'TM';
    machineJourney.push({
      step: 1,
      process: origin,
      machine: orderInfo?.machine ?? null,
      status: origin === resolvedLot.current_process ? 'ACTIVE' : 'COMPLETED',
      completedAt: null,
    });
    if (resolvedLot.current_process !== origin) {
      machineJourney.push({
        step: 2,
        process: resolvedLot.current_process,
        machine: null,
        status: 'ACTIVE',
        completedAt: null,
      });
    }
  }

  const workOrderNo =
    resolvedLot?.work_order_no ??
    primary.row.work_order_no ??
    orderInfo?.workOrderNo ??
    null;
  const coilTag =
    resolvedLot?.coil_tag ??
    resolvedLot?.lot_tag ??
    primary.row.coil_tag ??
    primary.row.coil_no ??
    orderInfo?.coilNo ??
    null;

  const history = await loadHistory({
    lot: resolvedLot,
    workOrderNo,
    coilTag,
  });

  const lineage = buildLineage(resolvedLot, handoffs);

  return {
    query: q,
    targetCoilNo: coilTag || orderInfo?.coilNo || q,
    lineage,
    history,
    orderInfo,
    machineJourney,
    searchedBy: opts.searchedBy || 'postgres',
  };
}

/**
 * Postgres autocomplete when ES is unavailable.
 * Coils first, then WO, then customer name.
 * @param {string} qRaw
 * @returns {Promise<{ text: string, type: 'coil'|'wo'|'customer', score: number, label?: string }[]>}
 */
export async function suggestPostgres(qRaw) {
  const q = String(qRaw || '').trim();
  if (q.length < 2) return [];

  const tenant = TENANT();
  const pattern = `%${q}%`;
  const out = [];
  const seen = new Set();

  function push(text, type, score, label) {
    const key = `${type}:${text}`;
    if (!text || seen.has(key) || seen.has(text)) return;
    seen.add(key);
    seen.add(text);
    out.push({ text, type, score, ...(label && label !== text ? { label } : {}) });
  }

  // 1) Coils first
  const coils = await safeQuery(
    `SELECT DISTINCT coil_tag AS text FROM txn.prod_tm_coil_input
     WHERE tenant_id = $1 AND coil_tag ILIKE $2
     UNION
     SELECT DISTINCT coil_tag AS text FROM txn.material_lot
     WHERE tenant_id = $1 AND coil_tag ILIKE $2 AND coil_tag IS NOT NULL
     UNION
     SELECT DISTINCT lot_tag AS text FROM txn.material_lot
     WHERE tenant_id = $1 AND lot_tag ILIKE $2
     UNION
     SELECT DISTINCT coil_no AS text FROM erp.released_order_line
     WHERE tenant_id = $1 AND coil_no ILIKE $2 AND coil_no IS NOT NULL
     LIMIT 15`,
    [tenant, pattern]
  );
  for (const r of coils) {
    push(String(r.text || '').trim(), 'coil', 1);
  }

  // 2) Work orders
  const wos = await safeQuery(
    `SELECT DISTINCT work_order_no AS text FROM erp.released_order
     WHERE tenant_id = $1 AND work_order_no ILIKE $2
     UNION
     SELECT DISTINCT work_order_no AS text FROM ops.queue_card
     WHERE tenant_id = $1 AND work_order_no ILIKE $2 AND work_order_no IS NOT NULL
     UNION
     SELECT DISTINCT work_order_no AS text FROM txn.prod_tm_run
     WHERE tenant_id = $1 AND work_order_no ILIKE $2 AND work_order_no IS NOT NULL
     UNION
     SELECT DISTINCT work_order_no AS text FROM txn.material_lot
     WHERE tenant_id = $1 AND work_order_no ILIKE $2 AND work_order_no IS NOT NULL
     LIMIT 15`,
    [tenant, pattern]
  );
  for (const r of wos) {
    push(String(r.text || '').trim(), 'wo', 0.9);
  }

  // 3) Customer name / code — text is customer_code (resolvable); label shows name
  const customers = await safeQuery(
    `SELECT code, name
     FROM master.customer
     WHERE tenant_id = $1 AND (name ILIKE $2 OR code ILIKE $2)
     ORDER BY name
     LIMIT 10`,
    [tenant, pattern]
  );
  for (const r of customers) {
    const code = String(r.code || '').trim();
    const name = String(r.name || '').trim();
    if (!code) continue;
    push(code, 'customer', 0.8, name ? `${name} (${code})` : code);
  }

  return out.slice(0, 20);
}

export { TraceNotFoundError };
