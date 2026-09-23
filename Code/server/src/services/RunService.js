import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { resolveRunDefaults, theoreticalTubeWeightKg, strictTheoreticalTubeWeightKg } from './ParamBandService';
import {
  getQueueCard,
  markQueueInProgress,
  markQueueHoldByRunId,
  markQueueInProgressByRunId,
  markQueueCompletedByRunId
} from './QueueService';

import { publishRunOpened, publishRunClosed, publishMachineState } from '../events/DomainEvents';
import { transition } from './StateMachine';

/** Fixed labels only — actual bundle_no is allocated to avoid colliding with collector cuts. */
const PROD_BUCKET_META = {
  PRIME: { qualityClass: 'PRIME', pq2Reason: null, finalSource: 'PLC' },
  PQ2_JOINT: { qualityClass: 'PQ2', pq2Reason: 'JOINT', finalSource: 'MANUAL' },
  PQ2_OTHER: { qualityClass: 'PQ2', pq2Reason: 'OTHER', finalSource: 'MANUAL' },
  CQ: { qualityClass: 'CQ', pq2Reason: null, finalSource: 'MANUAL' },
  OPEN: { qualityClass: 'OPEN', pq2Reason: null, finalSource: 'MANUAL' },
  SCRAP: { qualityClass: 'SCRAP', pq2Reason: null, finalSource: 'MANUAL' }
};

async function nextBundleNo(runId) {
  const row = await queryOne(
    `SELECT COALESCE(MAX(bundle_no), 0) + 1 AS n FROM txn.prod_tm_bundle WHERE run_id = $1`,
    [runId]
  );
  return Number(row?.n ?? 1);
}

function nullableMt(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function kgToMt(kg) {
  if (kg == null || !Number.isFinite(kg)) return null;
  return Math.round(kg / 1000 * 1000) / 1000;
}


































function formatRun(row, defaults) {
  return {
    id: row.id,
    runNo: row.run_no,
    millCode: row.mill_code,
    workOrderNo: row.work_order_no,
    bcBatchNumber: row.bc_batch_number,
    customerCode: row.customer_code,
    gradeCode: row.grade_code,
    size: row.size,
    sizeKey: row.size_key,
    setupId: row.setup_id,
    runState: row.run_state,
    firstOffStatus: row.first_off_status,
    firstOffBy: row.first_off_by,
    firstOffAt: row.first_off_at,
    rawMaterialMt: nullableMt(row.raw_material_mt),
    totalPrimeMt: nullableMt(row.total_prime_mt),
    totalPq2Mt: nullableMt(row.total_pq2_mt),
    totalCqMt: nullableMt(row.total_cq_mt),
    totalOpenMt: nullableMt(row.total_open_mt),
    totalScrapMt: nullableMt(row.total_scrap_mt),
    yieldPct: row.yield_pct != null && row.yield_pct !== '' ? Number(row.yield_pct) : null,
    status: row.status,
    remarks: row.remarks,
    timeFrom: row.time_from,
    timeTo: row.time_to,
    holdStatus: row.hold_status ?? 'NONE',
    remarksLog: Array.isArray(row.remarks_log) ? row.remarks_log : [],
    grossRuntimeS: row.gross_runtime_s ?? null,
    netRuntimeS: row.net_runtime_s ?? null,
    tooling: defaults?.tooling ?? null,
    band: defaults?.band ?? null,
    production: null,
    slitNo: null,
    mtdMt: null,
    hourlyProductionMt: null,
    energyKwh: null,
    energyCostInr: null
  };
}

export async function openRun(
queueCardId,
millCode,
setupType)
{
  const card = await getQueueCard(queueCardId);
  if (!card) throw new Error('Queue card not found');
  if (card.status !== 'Pending') throw new Error('Queue card is not pending');

  const size = card.size;
  const thkMm = size.thkMm ?? 0;
  const defaults = await resolveRunDefaults(card.size_key, thkMm, card.grade_code);
  if (!defaults) throw new Error(`No TM-02 chart entry for ${card.size_key} / ${thkMm} / ${card.grade_code}`);

  const runNo = `${millCode}-${Date.now()}`;
  const run = await queryOne(
    `INSERT INTO txn.prod_tm_run (
      tenant_id, run_no, mill_code, work_order_no, bc_batch_number,
      customer_code, grade_code, size, size_key, run_state, time_from, created_by, data_source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'IDLE',NULL,'operator','MANUAL')
    RETURNING *`,
    [
    config.tenantId,
    runNo,
    millCode,
    card.work_order_no,
    card.bc_batch_number,
    card.customer_code,
    card.grade_code,
    JSON.stringify(card.size),
    card.size_key]

  );

  if (!run) throw new Error('Failed to create run');

  // Production Console is manual-first: do not start collector / PLC.
  // Operator presses START to begin RUNNING and record time_from.

  await markQueueInProgress(queueCardId, run.id);

  await publishRunOpened({
    runId: run.id,
    millCode,
    workOrderNo: card.work_order_no,
    sizeKey: card.size_key,
    gradeCode: card.grade_code,
    openedAt: new Date().toISOString()
  });
  await publishMachineState({
    millCode,
    runId: run.id,
    state: 'IDLE',
    at: new Date().toISOString()
  });

  return enrichRun(formatRun(run, defaults), run.id);
}

export async function getRun(runId) {
  const run = await queryOne(`SELECT * FROM txn.prod_tm_run WHERE id = $1 AND tenant_id = $2`, [
  runId,
  config.tenantId]
  );
  if (!run) return null;

  const size = run.size;
  const defaults = await resolveRunDefaults(run.size_key, size.thkMm ?? 0, run.grade_code ?? '1010');
  const formatted = formatRun(run, defaults ?? undefined);
  const setup = await queryOne(
    `SELECT id_tool, od_tool, boggie_size, impeder_size, ferrite_rod, ss_rod, work_coil_id, seam_guide, weld_dia_mm
     FROM txn.tm_setup WHERE run_id = $1`,
    [runId]
  );
  if (setup && (setup.id_tool || setup.od_tool || setup.work_coil_id)) {
    formatted.tooling = {
      idTool: setup.id_tool ?? defaults?.tooling?.idTool,
      odTool: setup.od_tool ?? defaults?.tooling?.odTool,
      boggieSize: setup.boggie_size ?? defaults?.tooling?.boggieSize,
      impederSize: setup.impeder_size ?? defaults?.tooling?.impederSize,
      ferriteRod: setup.ferrite_rod ?? defaults?.tooling?.ferriteRod,
      ssRod: setup.ss_rod ?? defaults?.tooling?.ssRod,
      workCoilId: setup.work_coil_id ?? defaults?.tooling?.workCoilId,
      seamGuide: setup.seam_guide ?? defaults?.tooling?.seamGuide,
      weldDiaMm: setup.weld_dia_mm != null ? Number(setup.weld_dia_mm) : defaults?.tooling?.weldDiaMm ?? null
    };
    formatted.setupConfirmed = true;
  }
  return enrichRun(formatted, runId);
}

async function loadSlitNo(runId) {
  const coil = await queryOne(
    `SELECT coil_tag, work_order_no, source
     FROM txn.prod_tm_coil_input
     WHERE run_id = $1
     ORDER BY splice_seq NULLS LAST, created_at
     LIMIT 1`,
    [runId]
  );
  if (!coil) return null;
  const slit = coil.coil_tag || coil.source || coil.work_order_no || null;
  return slit ? String(slit) : null;
}

function emptyProductionBuckets() {
  return {
    primeNo: null,
    primeWtMt: null,
    pq2JointNo: null,
    pq2JointWtMt: null,
    pq2OtherNo: null,
    pq2OtherWtMt: null,
    cqNo: null,
    cqWtMt: null,
    openNo: null,
    openWtMt: null,
    scrapWtMt: null,
    totalNo: null,
    totalWtMt: null
  };
}

async function loadProductionBuckets(runId, size) {
  const rows = await query(
    `SELECT quality_class, pq2_reason, pieces, weight_kg, current_input_mode, final_source
     FROM txn.prod_tm_bundle
     WHERE run_id = $1 AND current_input_mode = 'MANUAL'`,
    [runId]
  );
  const out = emptyProductionBuckets();

  for (const row of rows) {
    const pieces = row.pieces != null ? Number(row.pieces) : null;
    const weightKg = row.weight_kg != null ? Number(row.weight_kg) : null;
    const wtMt = kgToMt(weightKg);

    if (row.quality_class === 'PRIME') {
      out.primeNo = pieces;
      out.primeWtMt = wtMt;
    } else if (row.quality_class === 'PQ2' && row.pq2_reason === 'JOINT') {
      out.pq2JointNo = pieces;
      out.pq2JointWtMt = wtMt;
    } else if (row.quality_class === 'PQ2' && row.pq2_reason === 'OTHER') {
      out.pq2OtherNo = pieces;
      out.pq2OtherWtMt = wtMt;
    } else if (row.quality_class === 'CQ') {
      out.cqNo = pieces;
      out.cqWtMt = wtMt;
    } else if (row.quality_class === 'OPEN') {
      out.openNo = pieces;
      out.openWtMt = wtMt;
    } else if (row.quality_class === 'SCRAP') {
      out.scrapWtMt = wtMt;
    }
  }

  // Recompute derived weights from size when pieces exist (strict — no invented dims).
  const applyDerived = (pieces) => {
    if (pieces == null) return null;
    return kgToMt(strictTheoreticalTubeWeightKg(size, pieces));
  };
  if (out.primeNo != null) out.primeWtMt = applyDerived(out.primeNo) ?? out.primeWtMt;
  if (out.pq2JointNo != null) out.pq2JointWtMt = applyDerived(out.pq2JointNo) ?? out.pq2JointWtMt;
  if (out.pq2OtherNo != null) out.pq2OtherWtMt = applyDerived(out.pq2OtherNo) ?? out.pq2OtherWtMt;
  if (out.cqNo != null) out.cqWtMt = applyDerived(out.cqNo) ?? out.cqWtMt;
  if (out.openNo != null) out.openWtMt = applyDerived(out.openNo) ?? out.openWtMt;

  const countParts = [out.primeNo, out.pq2JointNo, out.pq2OtherNo, out.cqNo, out.openNo];
  const anyCount = countParts.some((n) => n != null);
  out.totalNo = anyCount ? countParts.reduce((s, n) => s + (n ?? 0), 0) : null;

  const weightParts = [out.primeWtMt, out.pq2JointWtMt, out.pq2OtherWtMt, out.cqWtMt, out.openWtMt];
  const anyWeight = weightParts.some((w) => w != null);
  out.totalWtMt = anyWeight
    ? Math.round(weightParts.reduce((s, w) => s + (w ?? 0), 0) * 1000) / 1000
    : null;

  return out;
}

async function loadMtdMt(millCode, asOf = new Date()) {
  const row = await queryOne(
    `SELECT
       SUM(COALESCE(total_prime_mt,0) + COALESCE(total_pq2_mt,0) + COALESCE(total_cq_mt,0) + COALESCE(total_open_mt,0))
         AS mtd_mt
     FROM txn.prod_tm_run
     WHERE tenant_id = $1
       AND mill_code = $2
       AND date_trunc('month', COALESCE(prod_date, created_at)) = date_trunc('month', $3::timestamptz)
       AND (
         total_prime_mt IS NOT NULL OR total_pq2_mt IS NOT NULL
         OR total_cq_mt IS NOT NULL OR total_open_mt IS NOT NULL
       )`,
    [config.tenantId, millCode, asOf.toISOString()]
  );
  const mtd = nullableMt(row?.mtd_mt);
  if (mtd == null || mtd === 0) {
    // Distinguish "no rows" from a real zero: check existence.
    const any = await queryOne(
      `SELECT 1 AS ok
       FROM txn.prod_tm_run
       WHERE tenant_id = $1
         AND mill_code = $2
         AND date_trunc('month', COALESCE(prod_date, created_at)) = date_trunc('month', $3::timestamptz)
         AND (
           total_prime_mt IS NOT NULL OR total_pq2_mt IS NOT NULL
           OR total_cq_mt IS NOT NULL OR total_open_mt IS NOT NULL
         )
       LIMIT 1`,
      [config.tenantId, millCode, asOf.toISOString()]
    );
    if (!any) return null;
  }
  return mtd;
}

function computeHourlyProductionMt(totalWtMt, timeFrom, timeTo, netRuntimeS) {
  if (totalWtMt == null) return null;
  let hours = null;
  if (netRuntimeS != null && Number(netRuntimeS) > 0) {
    hours = Number(netRuntimeS) / 3600;
  } else if (timeFrom) {
    const end = timeTo ? new Date(timeTo) : new Date();
    const ms = end.getTime() - new Date(timeFrom).getTime();
    if (ms > 0) hours = ms / 3_600_000;
  }
  if (hours == null || hours <= 0) return null;
  return Math.round(totalWtMt / hours * 1000) / 1000;
}

async function enrichRun(formatted, runId) {
  const size = formatted.size ?? {};
  const production = await loadProductionBuckets(runId, size);
  formatted.production = production;
  formatted.slitNo = await loadSlitNo(runId);
  formatted.mtdMt = await loadMtdMt(formatted.millCode);
  formatted.hourlyProductionMt = computeHourlyProductionMt(
    production.totalWtMt,
    formatted.timeFrom,
    formatted.timeTo,
    formatted.netRuntimeS
  );
  // Energy is welder/PLC export — never invent.
  formatted.energyKwh = null;
  formatted.energyCostInr = null;
  return formatted;
}

export async function addCoilInput(runId, input) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  const row = await queryOne(
    `INSERT INTO txn.prod_tm_coil_input (
      tenant_id, run_id, coil_tag, grade_code, width_mm, thk_mm, swg, input_weight_kg, splice_seq, joint_marker,
      slit_hardness, width_s_mm, width_m_mm, width_e_mm, thk_s_mm, thk_m_mm, thk_e_mm, rejection_remark, work_order_no
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING *`,
    [
    config.tenantId,
    runId,
    input.coilTag,
    input.gradeCode ?? null,
    input.widthMm ?? null,
    input.thkMm ?? null,
    input.swg ?? null,
    input.inputWeightKg ?? null,
    input.spliceSeq ?? null,
    input.jointMarker ?? false,
    input.slitHardness ?? null,
    input.widthSMm ?? null,
    input.widthMMm ?? null,
    input.widthEMm ?? null,
    input.thkSMm ?? null,
    input.thkMMm ?? null,
    input.thkEMm ?? null,
    input.rejectionRemark ?? null,
    input.workOrderNo ?? null]

  );

  await recalcRunRollups(runId);
  return row;
}

export async function addBundle(runId, bundle) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  const size = run.size;
  const weightKg =
  bundle.weightKg ??
  theoreticalTubeWeightKg(size, bundle.pieces);

  // Allocate next bundle_no safely (avoids collision with auto piece bundles)
  const maxRow = await queryOne(
    `SELECT COALESCE(MAX(bundle_no), 0)::int AS max_no FROM txn.prod_tm_bundle WHERE run_id = $1`,
    [runId]
  );
  const requested = bundle.bundleNo;
  const next = (maxRow?.max_no ?? 0) + 1;
  const bundleNo =
  Number.isFinite(requested) && requested > (maxRow?.max_no ?? 0) ? requested : next;

  const row = await queryOne(
    `INSERT INTO txn.prod_tm_bundle (
      tenant_id, run_id, bundle_no, pieces, length_mm, weight_kg, weight_source, quality_class, pq2_reason
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`,
    [
    config.tenantId,
    runId,
    bundleNo,
    bundle.pieces,
    bundle.lengthMm ?? size.lengthMm ?? null,
    weightKg,
    bundle.weightSource,
    bundle.qualityClass,
    bundle.pq2Reason ?? null]

  );

  await recalcRunRollups(runId);
  return row;
}

export async function recalcRunRollups(runId) {
  const coils = await queryOne(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(input_weight_kg), 0) AS total_kg
     FROM txn.prod_tm_coil_input WHERE run_id = $1`,
    [runId]
  );

  const bundles = await query(
    `SELECT quality_class, weight_kg, pieces FROM txn.prod_tm_bundle WHERE run_id = $1`,
    [runId]
  );

  let prime = null;
  let pq2 = null;
  let cq = null;
  let open = null;
  let scrap = null;
  let hasAnyWeight = false;

  for (const b of bundles) {
    if (b.weight_kg == null) continue;
    const w = Number(b.weight_kg) / 1000;
    hasAnyWeight = true;
    switch (b.quality_class) {
      case 'PRIME':
        prime = (prime ?? 0) + w;
        break;
      case 'PQ2':
        pq2 = (pq2 ?? 0) + w;
        break;
      case 'CQ':
        cq = (cq ?? 0) + w;
        break;
      case 'OPEN':
        open = (open ?? 0) + w;
        break;
      case 'SCRAP':
        scrap = (scrap ?? 0) + w;
        break;
    }
  }

  const coilCount = Number(coils?.n ?? 0);
  const rawMt = coilCount > 0 ? Number(coils.total_kg) / 1000 : null;
  const accepted =
    (prime ?? 0) + (pq2 ?? 0) + (cq ?? 0) + (open ?? 0);
  const hasAccepted = prime != null || pq2 != null || cq != null || open != null;
  const yieldPct =
    rawMt != null && rawMt > 0 && hasAccepted
      ? Math.round(accepted / rawMt * 1000) / 10
      : null;

  await query(
    `UPDATE txn.prod_tm_run SET
      raw_material_mt = $2,
      total_prime_mt = $3,
      total_pq2_mt = $4,
      total_cq_mt = $5,
      total_open_mt = $6,
      total_scrap_mt = $7,
      yield_pct = $8
     WHERE id = $1`,
    [
      runId,
      rawMt,
      hasAnyWeight ? prime : null,
      hasAnyWeight ? pq2 : null,
      hasAnyWeight ? cq : null,
      hasAnyWeight ? open : null,
      scrap,
      yieldPct
    ]
  );
}

/**
 * Upsert production-console quantity buckets (PRD-06..17).
 * Null clears a bucket. Undefined leaves it unchanged.
 */
export async function updateProductionQuantities(runId, form) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.runState === 'RUN_COMPLETE' || ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run.status)) {
    throw new Error('Production quantities are locked for this run');
  }

  const size = run.size ?? {};
  const buckets = [
    { key: 'primeNo', ...PROD_BUCKET_META.PRIME, pieces: form.primeNo },
    { key: 'pq2JointNo', ...PROD_BUCKET_META.PQ2_JOINT, pieces: form.pq2JointNo },
    { key: 'pq2OtherNo', ...PROD_BUCKET_META.PQ2_OTHER, pieces: form.pq2OtherNo },
    { key: 'cqNo', ...PROD_BUCKET_META.CQ, pieces: form.cqNo },
    { key: 'openNo', ...PROD_BUCKET_META.OPEN, pieces: form.openNo }
  ];

  for (const bucket of buckets) {
    if (bucket.pieces === undefined) continue;
    await upsertCountBucket(runId, size, bucket);
  }

  if (form.scrapWtMt !== undefined) {
    await upsertScrapBucket(runId, form.scrapWtMt);
  }

  await recalcRunRollups(runId);
  return getRun(runId);
}

async function upsertCountBucket(runId, size, bucket) {
  const existing = await queryOne(
    `SELECT id FROM txn.prod_tm_bundle
     WHERE run_id = $1 AND current_input_mode = 'MANUAL'
       AND quality_class = $2
       AND COALESCE(pq2_reason, '') = COALESCE($3, '')`,
    [runId, bucket.qualityClass, bucket.pq2Reason]
  );

  if (bucket.pieces == null) {
    if (existing) {
      await query(`DELETE FROM txn.prod_tm_bundle WHERE id = $1`, [existing.id]);
    }
    return;
  }

  const pieces = Number(bucket.pieces);
  if (!Number.isFinite(pieces) || pieces < 0 || !Number.isInteger(pieces)) {
    throw new Error(`Invalid pieces for ${bucket.key}`);
  }

  const weightKg = strictTheoreticalTubeWeightKg(size, pieces);
  const lengthMm = size.lengthMm ?? null;

  if (existing) {
    await query(
      `UPDATE txn.prod_tm_bundle SET
        pieces = $2,
        length_mm = $3,
        weight_kg = $4,
        weight_source = 'DERIVED',
        final_source = $5,
        current_input_mode = 'MANUAL'
       WHERE id = $1`,
      [existing.id, pieces, lengthMm, weightKg, bucket.finalSource]
    );
    return;
  }

  const bundleNo = await nextBundleNo(runId);
  await query(
    `INSERT INTO txn.prod_tm_bundle (
      tenant_id, run_id, bundle_no, pieces, length_mm, weight_kg, weight_source,
      quality_class, pq2_reason, final_source, current_input_mode
    ) VALUES ($1,$2,$3,$4,$5,$6,'DERIVED',$7,$8,$9,'MANUAL')`,
    [
      config.tenantId,
      runId,
      bundleNo,
      pieces,
      lengthMm,
      weightKg,
      bucket.qualityClass,
      bucket.pq2Reason,
      bucket.finalSource
    ]
  );
}

async function upsertScrapBucket(runId, scrapWtMt) {
  const existing = await queryOne(
    `SELECT id FROM txn.prod_tm_bundle
     WHERE run_id = $1 AND current_input_mode = 'MANUAL' AND quality_class = 'SCRAP'`,
    [runId]
  );

  if (scrapWtMt == null) {
    if (existing) {
      await query(`DELETE FROM txn.prod_tm_bundle WHERE id = $1`, [existing.id]);
    }
    return;
  }

  const mt = Number(scrapWtMt);
  if (!Number.isFinite(mt) || mt < 0) throw new Error('Invalid scrap weight');
  const weightKg = Math.round(mt * 1000 * 100) / 100;

  if (existing) {
    await query(
      `UPDATE txn.prod_tm_bundle SET
        pieces = 0,
        weight_kg = $2,
        weight_source = 'MEASURED',
        final_source = 'MANUAL',
        current_input_mode = 'MANUAL'
       WHERE id = $1`,
      [existing.id, weightKg]
    );
    return;
  }

  const bundleNo = await nextBundleNo(runId);
  await query(
    `INSERT INTO txn.prod_tm_bundle (
      tenant_id, run_id, bundle_no, pieces, weight_kg, weight_source,
      quality_class, final_source, current_input_mode
    ) VALUES ($1,$2,$3,0,$4,'MEASURED','SCRAP','MANUAL','MANUAL')`,
    [config.tenantId, runId, bundleNo, weightKg]
  );
}

export async function submitRun(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'DRAFT') throw new Error('Only DRAFT runs can be submitted');
  await updateRuntimeRollups(runId);
  await query(
    `UPDATE txn.prod_tm_run SET status = 'SUBMITTED', time_to = now(), run_state = 'RUN_COMPLETE' WHERE id = $1`,
    [runId]
  );
  const closed = await getRun(runId);
  if (closed) {
    await publishRunClosed({
      runId,
      millCode: closed.millCode,
      rawMaterialMt: closed.rawMaterialMt ?? 0,
      acceptedMt:
        (closed.totalPrimeMt ?? 0) +
        (closed.totalPq2Mt ?? 0) +
        (closed.totalCqMt ?? 0) +
        (closed.totalOpenMt ?? 0),
      yieldPct: closed.yieldPct ?? 0,
      closedAt: new Date().toISOString()
    });
    await publishMachineState({
      millCode: closed.millCode,
      runId,
      state: 'RUN_COMPLETE',
      at: new Date().toISOString()
    });
  }
  return closed;
}

export async function approveRun(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'SUBMITTED') throw new Error('Run must be SUBMITTED before approve');
  await query(`UPDATE txn.prod_tm_run SET status = 'APPROVED' WHERE id = $1`, [runId]);
  try {
    const { enqueueTmWriteback } = await import('../erp/ErpWritebackService.js');
    await enqueueTmWriteback(runId);
  } catch (err) {
    console.warn('[erp] TM writeback enqueue failed:', err instanceof Error ? err.message : err);
  }
  try {
    const { publishTmMaterialLots } = await import('./GenealogyService.js');
    await publishTmMaterialLots(runId);
  } catch (err) {
    console.warn('[genealogy] TM material lot publish failed:', err instanceof Error ? err.message : err);
  }
  return getRun(runId);
}

export async function lockRun(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'APPROVED' && run.status !== 'SUBMITTED') {
    throw new Error('Run must be APPROVED (or SUBMITTED) before lock');
  }
  await query(`UPDATE txn.prod_tm_run SET status = 'LOCKED', run_state = 'RUN_COMPLETE' WHERE id = $1`, [runId]);
  return getRun(runId);
}

export async function getCoils(runId) {
  return query(`SELECT * FROM txn.prod_tm_coil_input WHERE run_id = $1 ORDER BY splice_seq, created_at`, [runId]);
}

export async function getBundles(runId) {
  return query(`SELECT * FROM txn.prod_tm_bundle WHERE run_id = $1 ORDER BY bundle_no`, [runId]);
}

export async function getStoppages(runId) {
  const rows = await query(
    `SELECT * FROM txn.stoppage_entry WHERE run_id = $1 ORDER BY from_time DESC`,
    [runId]
  );
  return rows.map((s) => {
    const raw = s.is_open;
    const open =
    raw === true ||
    raw === 1 ||
    String(raw).toLowerCase() === 't' ||
    String(raw).toLowerCase() === 'true';
    return { ...s, is_open: open };
  });
}

export async function updateRunState(runId, runState) {
  await query(`UPDATE txn.prod_tm_run SET run_state = $2 WHERE id = $1`, [runId, runState]);
  const run = await queryOne(`SELECT mill_code FROM txn.prod_tm_run WHERE id = $1`, [runId]);
  if (run) {
    await publishMachineState({
      millCode: run.mill_code,
      runId,
      state: runState,
      at: new Date().toISOString()
    });
  }
}

export async function updateFirstOff(runId, result, approvedBy) {
  await query(
    `UPDATE txn.prod_tm_run SET first_off_status = $2, first_off_by = $3, first_off_at = now() WHERE id = $1`,
    [runId, result, approvedBy]
  );
  await query(
    `UPDATE txn.tm_setup SET first_off_result = $2, approved_by = $3, approved_at = now()
     WHERE run_id = $1`,
    [runId, result, approvedBy]
  );
}

export async function updateRuntimeRollups(runId) {
  const run = await queryOne(
    `SELECT time_from, time_to FROM txn.prod_tm_run WHERE id = $1`,
    [runId]
  );
  if (!run?.time_from) return;
  const end = run.time_to ? new Date(run.time_to) : new Date();
  const start = new Date(run.time_from);
  const gross = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  const stop = await queryOne(
    `SELECT COALESCE(SUM(COALESCE(duration_min, 0) * 60), 0)::text AS lost_s
     FROM txn.stoppage_entry WHERE run_id = $1`,
    [runId]
  );
  const lost = Math.floor(Number(stop?.lost_s ?? 0));
  const net = Math.max(0, gross - lost);
  await query(`UPDATE txn.prod_tm_run SET gross_runtime_s = $2, net_runtime_s = $3 WHERE id = $1`, [
  runId,
  gross,
  net]
  );
}

export async function holdRun(runId, remark) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'DRAFT') throw new Error('Only DRAFT runs can be held');
  await query(`UPDATE txn.prod_tm_run SET hold_status = 'HELD' WHERE id = $1`, [runId]);
  await markQueueHoldByRunId(runId);
  if (remark) await appendRemark(runId, remark, 'HOLD');
  return getRun(runId);
}

export async function resumeRun(runId, remark) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  await query(`UPDATE txn.prod_tm_run SET hold_status = 'NONE' WHERE id = $1`, [runId]);
  await markQueueInProgressByRunId(runId);
  if (remark) await appendRemark(runId, remark, 'RESUME');
  return getRun(runId);
}

export async function appendRemark(runId, remark, kind = 'REMARK') {
  await query(
    `UPDATE txn.prod_tm_run SET
      remarks = $2,
      remarks_log = COALESCE(remarks_log, '[]'::jsonb) || $3::jsonb
     WHERE id = $1`,
    [runId, remark, JSON.stringify([{ at: new Date().toISOString(), kind, remark }])]
  );
  return getRun(runId);
}

export async function startProduction(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.holdStatus === 'HELD') throw new Error('Run is on HOLD — resume first');

  if (run.runState === 'RUNNING') {
    return run;
  }

  if (run.runState === 'IDLE') {
    await query(
      `UPDATE txn.prod_tm_run SET run_state = $2, time_from = COALESCE(time_from, now()) WHERE id = $1`,
      [runId, transition('IDLE', 'PRODUCTION_STARTED')]
    );
    await publishMachineState({
      millCode: run.millCode,
      runId,
      state: 'RUNNING',
      at: new Date().toISOString()
    });
    return getRun(runId);
  }

  if (run.runState === 'FIRST_OFF_PENDING' && run.firstOffStatus === 'PASS') {
    await updateRunState(runId, transition('FIRST_OFF_PENDING', 'FIRST_OFF_PASS'));
  } else if (run.runState === 'ROLL_CHANGE') {
    await updateRunState(runId, transition('ROLL_CHANGE', 'LINE_STARTED'));
  } else if (run.runState === 'STOPPAGE') {
    await updateRunState(runId, transition('STOPPAGE', 'LINE_STARTED'));
    await query(
      `UPDATE txn.stoppage_entry SET
        to_time = now(),
        duration_min = EXTRACT(EPOCH FROM (now() - from_time)) / 60,
        is_open = false
       WHERE run_id = $1 AND is_open = true`,
      [runId]
    );
  } else {
    throw new Error(`Cannot start from state ${run.runState}`);
  }

  // Manual-first: do not start PLC collector.
  return getRun(runId);
}

export async function endProduction(runId, remark) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  const state = run.runState;
  if (!['RUNNING', 'STOPPAGE', 'ROLL_CHANGE', 'SETUP', 'FIRST_OFF_PENDING', 'IDLE'].includes(state)) {
    throw new Error(`Cannot end from state ${state}`);
  }
  if (remark?.trim()) {
    await appendRemark(runId, remark.trim(), 'END');
  }

  // Close any open stoppage before completing.
  await query(
    `UPDATE txn.stoppage_entry SET
      to_time = COALESCE(to_time, now()),
      duration_min = COALESCE(
        duration_min,
        EXTRACT(EPOCH FROM (COALESCE(to_time, now()) - from_time)) / 60
      ),
      is_open = false
     WHERE run_id = $1 AND is_open = true`,
    [runId]
  );

  await query(`UPDATE txn.prod_tm_run SET time_to = now() WHERE id = $1`, [runId]);
  await updateRuntimeRollups(runId);
  await updateRunState(runId, transition(state, 'RUN_CLOSED'));
  await markQueueCompletedByRunId(runId);

  // Ensure collector is not writing (safe no-op if never started).
  try {
    const { stopCollectorForRun } = await import('../collector/CollectorRunner.js');
    stopCollectorForRun(runId);
  } catch {
    /* ignore */
  }

  return getRun(runId);
}

export async function rollChange(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.runState !== 'RUNNING') throw new Error('ROLL_CHANGE requires RUNNING');
  await updateRunState(runId, transition('RUNNING', 'ROLL_CHANGE'));
  return getRun(runId);
}

export async function listRuns(millCode = 'A-59', limit = 50) {
  const rows = await query(
    `SELECT * FROM txn.prod_tm_run WHERE tenant_id = $1 AND mill_code = $2
     ORDER BY created_at DESC LIMIT $3`,
    [config.tenantId, millCode, limit]
  );
  return Promise.all(
    rows.map(async (r) => {
      const size = r.size;
      const defaults = await resolveRunDefaults(r.size_key, size.thkMm ?? 0, r.grade_code ?? '1010');
      const formatted = formatRun(r, defaults ?? undefined);
      const setup = await queryOne(
        `SELECT id_tool, od_tool, boggie_size, impeder_size, ferrite_rod, ss_rod, work_coil_id, seam_guide, weld_dia_mm
         FROM txn.tm_setup WHERE run_id = $1`,
        [r.id]
      );
      if (setup) {
        formatted.tooling = {
          idTool: setup.id_tool,
          odTool: setup.od_tool,
          boggieSize: setup.boggie_size,
          impederSize: setup.impeder_size,
          ferriteRod: setup.ferrite_rod,
          ssRod: setup.ss_rod,
          workCoilId: setup.work_coil_id,
          seamGuide: setup.seam_guide,
          weldDiaMm: setup.weld_dia_mm != null ? Number(setup.weld_dia_mm) : null
        };
        formatted.setupConfirmed = true;
      }
      return formatted;
    })
  );
}

export async function claimHttpIdempotency(scope, key) {
  try {
    await query(`INSERT INTO txn.idempotency_key (scope, key) VALUES ($1, $2)`, [scope, key]);
    return true;
  } catch {
    return false;
  }
}