import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { resolveRunDefaults, theoreticalTubeWeightKg } from './ParamBandService';
import { getQueueCard, markQueueInProgress, markQueueHoldByRunId, markQueueInProgressByRunId } from './QueueService';
import type { M1TmBundleForm, M1TmCoilInputForm } from '@a59/shared';
import { publishRunOpened, publishRunClosed, publishMachineState } from '../events/DomainEvents';
import { transition } from './StateMachine';
import type { MillRunState } from '@a59/shared';

export interface RunRow {
  id: string;
  run_no: string;
  mill_code: string;
  work_order_no: string | null;
  bc_batch_number: string | null;
  customer_code: string | null;
  grade_code: string | null;
  size: Record<string, unknown>;
  size_key: string;
  setup_id: string | null;
  run_state: string;
  first_off_status: string;
  first_off_by: string | null;
  first_off_at: string | null;
  raw_material_mt: string;
  total_prime_mt: string;
  total_pq2_mt: string;
  total_cq_mt: string;
  total_open_mt: string;
  total_scrap_mt: string;
  yield_pct: string | null;
  status: string;
  remarks: string | null;
  time_from: string | null;
  time_to: string | null;
  hold_status: string;
  remarks_log: unknown;
  gross_runtime_s: number | null;
  net_runtime_s: number | null;
}

function formatRun(row: RunRow, defaults?: Awaited<ReturnType<typeof resolveRunDefaults>>) {
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
    rawMaterialMt: Number(row.raw_material_mt),
    totalPrimeMt: Number(row.total_prime_mt),
    totalPq2Mt: Number(row.total_pq2_mt),
    totalCqMt: Number(row.total_cq_mt),
    totalOpenMt: Number(row.total_open_mt),
    totalScrapMt: Number(row.total_scrap_mt),
    yieldPct: row.yield_pct ? Number(row.yield_pct) : null,
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
  };
}

export async function openRun(
  queueCardId: string,
  millCode: string,
  setupType: 'INITIAL' | 'REGULAR',
): Promise<ReturnType<typeof formatRun>> {
  const card = await getQueueCard(queueCardId);
  if (!card) throw new Error('Queue card not found');
  if (card.status !== 'Pending') throw new Error('Queue card is not pending');

  const size = card.size as { thkMm?: number };
  const thkMm = size.thkMm ?? 0;
  const defaults = await resolveRunDefaults(card.size_key, thkMm, card.grade_code);
  if (!defaults) throw new Error(`No TM-02 chart entry for ${card.size_key} / ${thkMm} / ${card.grade_code}`);

  const runNo = `${millCode}-${Date.now()}`;
  const run = await queryOne<RunRow>(
    `INSERT INTO txn.prod_tm_run (
      tenant_id, run_no, mill_code, work_order_no, bc_batch_number,
      customer_code, grade_code, size, size_key, run_state, time_from, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SETUP',now(),'operator')
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
      card.size_key,
    ],
  );

  if (!run) throw new Error('Failed to create run');

  const setup = await queryOne<{ id: string }>(
    `INSERT INTO txn.tm_setup (
      tenant_id, run_id, setup_type, reason,
      id_tool, od_tool, boggie_size, impeder_size, ferrite_rod, ss_rod, work_coil_id, seam_guide, weld_dia_mm
    ) VALUES ($1,$2,$3,'NEW_PRODUCT',$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING id`,
    [
      config.tenantId,
      run.id,
      setupType,
      defaults.tooling.idTool,
      defaults.tooling.odTool,
      defaults.tooling.boggieSize,
      defaults.tooling.impederSize,
      defaults.tooling.ferriteRod,
      defaults.tooling.ssRod,
      defaults.tooling.workCoilId,
      defaults.tooling.seamGuide,
      defaults.tooling.weldDiaMm,
    ],
  );

  if (setup) {
    await query(`UPDATE txn.prod_tm_run SET setup_id = $2 WHERE id = $1`, [run.id, setup.id]);
    run.setup_id = setup.id;
  }

  await markQueueInProgress(queueCardId, run.id);
  const { startCollectorForRun } = await import('../collector/CollectorRunner');
  startCollectorForRun(run.id);

  await publishRunOpened({
    runId: run.id,
    millCode,
    workOrderNo: card.work_order_no,
    sizeKey: card.size_key,
    gradeCode: card.grade_code,
    openedAt: new Date().toISOString(),
  });
  await publishMachineState({
    millCode,
    runId: run.id,
    state: 'SETUP',
    at: new Date().toISOString(),
  });

  return formatRun(run, defaults);
}

export async function getRun(runId: string) {
  const run = await queryOne<RunRow>(`SELECT * FROM txn.prod_tm_run WHERE id = $1 AND tenant_id = $2`, [
    runId,
    config.tenantId,
  ]);
  if (!run) return null;

  const size = run.size as { thkMm?: number };
  const defaults = await resolveRunDefaults(run.size_key, size.thkMm ?? 0, run.grade_code ?? '1010');
  return formatRun(run, defaults ?? undefined);
}

export async function addCoilInput(runId: string, input: M1TmCoilInputForm) {
  const row = await queryOne(
    `INSERT INTO txn.prod_tm_coil_input (
      tenant_id, run_id, coil_tag, grade_code, width_mm, thk_mm, swg, input_weight_kg, splice_seq, joint_marker
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
    ],
  );

  await recalcRunRollups(runId);
  return row;
}

export async function addBundle(runId: string, bundle: M1TmBundleForm) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  const size = run.size as Parameters<typeof theoreticalTubeWeightKg>[0];
  const weightKg =
    bundle.weightKg ??
    theoreticalTubeWeightKg(size, bundle.pieces);

  // Allocate next bundle_no safely (avoids collision with auto piece bundles)
  const maxRow = await queryOne<{ max_no: number }>(
    `SELECT COALESCE(MAX(bundle_no), 0)::int AS max_no FROM txn.prod_tm_bundle WHERE run_id = $1`,
    [runId],
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
      bundle.lengthMm ?? (size.lengthMm as number | undefined) ?? null,
      weightKg,
      bundle.weightSource,
      bundle.qualityClass,
      bundle.pq2Reason ?? null,
    ],
  );

  await recalcRunRollups(runId);
  return row;
}

export async function recalcRunRollups(runId: string): Promise<void> {
  const coils = await queryOne<{ total_kg: string }>(
    `SELECT COALESCE(SUM(input_weight_kg), 0) AS total_kg FROM txn.prod_tm_coil_input WHERE run_id = $1`,
    [runId],
  );

  const bundles = await query<{ quality_class: string; weight_kg: string }>(
    `SELECT quality_class, weight_kg FROM txn.prod_tm_bundle WHERE run_id = $1`,
    [runId],
  );

  let prime = 0;
  let pq2 = 0;
  let cq = 0;
  let open = 0;
  let scrap = 0;

  for (const b of bundles) {
    const w = Number(b.weight_kg) / 1000;
    switch (b.quality_class) {
      case 'PRIME':
        prime += w;
        break;
      case 'PQ2':
        pq2 += w;
        break;
      case 'CQ':
        cq += w;
        break;
      case 'OPEN':
        open += w;
        break;
      case 'SCRAP':
        scrap += w;
        break;
    }
  }

  const rawMt = Number(coils?.total_kg ?? 0) / 1000;
  const accepted = prime + pq2 + cq + open;
  const yieldPct = rawMt > 0 ? Math.round((accepted / rawMt) * 1000) / 10 : null;

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
    [runId, rawMt, prime, pq2, cq, open, scrap, yieldPct],
  );
}

export async function submitRun(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'DRAFT') throw new Error('Only DRAFT runs can be submitted');
  await updateRuntimeRollups(runId);
  await query(
    `UPDATE txn.prod_tm_run SET status = 'SUBMITTED', time_to = now(), run_state = 'RUN_COMPLETE' WHERE id = $1`,
    [runId],
  );
  const closed = await getRun(runId);
  if (closed) {
    await publishRunClosed({
      runId,
      millCode: closed.millCode,
      rawMaterialMt: closed.rawMaterialMt,
      acceptedMt: closed.totalPrimeMt + closed.totalPq2Mt + closed.totalCqMt + closed.totalOpenMt,
      yieldPct: closed.yieldPct ?? 0,
      closedAt: new Date().toISOString(),
    });
    await publishMachineState({
      millCode: closed.millCode,
      runId,
      state: 'RUN_COMPLETE',
      at: new Date().toISOString(),
    });
  }
  return closed;
}

export async function approveRun(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'SUBMITTED') throw new Error('Run must be SUBMITTED before approve');
  await query(`UPDATE txn.prod_tm_run SET status = 'APPROVED' WHERE id = $1`, [runId]);
  return getRun(runId);
}

export async function lockRun(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'APPROVED' && run.status !== 'SUBMITTED') {
    throw new Error('Run must be APPROVED (or SUBMITTED) before lock');
  }
  await query(`UPDATE txn.prod_tm_run SET status = 'LOCKED', run_state = 'RUN_COMPLETE' WHERE id = $1`, [runId]);
  return getRun(runId);
}

export async function getCoils(runId: string) {
  return query(`SELECT * FROM txn.prod_tm_coil_input WHERE run_id = $1 ORDER BY splice_seq, created_at`, [runId]);
}

export async function getBundles(runId: string) {
  return query(`SELECT * FROM txn.prod_tm_bundle WHERE run_id = $1 ORDER BY bundle_no`, [runId]);
}

export async function getStoppages(runId: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM txn.stoppage_entry WHERE run_id = $1 ORDER BY from_time DESC`,
    [runId],
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

export async function updateRunState(runId: string, runState: string) {
  await query(`UPDATE txn.prod_tm_run SET run_state = $2 WHERE id = $1`, [runId, runState]);
  const run = await queryOne<{ mill_code: string }>(`SELECT mill_code FROM txn.prod_tm_run WHERE id = $1`, [runId]);
  if (run) {
    await publishMachineState({
      millCode: run.mill_code,
      runId,
      state: runState,
      at: new Date().toISOString(),
    });
  }
}

export async function updateFirstOff(runId: string, result: 'PASS' | 'FAIL', approvedBy: string) {
  await query(
    `UPDATE txn.prod_tm_run SET first_off_status = $2, first_off_by = $3, first_off_at = now() WHERE id = $1`,
    [runId, result, approvedBy],
  );
  await query(
    `UPDATE txn.tm_setup SET first_off_result = $2, approved_by = $3, approved_at = now()
     WHERE run_id = $1`,
    [runId, result, approvedBy],
  );
}

export async function updateRuntimeRollups(runId: string): Promise<void> {
  const run = await queryOne<{ time_from: string | null; time_to: string | null }>(
    `SELECT time_from, time_to FROM txn.prod_tm_run WHERE id = $1`,
    [runId],
  );
  if (!run?.time_from) return;
  const end = run.time_to ? new Date(run.time_to) : new Date();
  const start = new Date(run.time_from);
  const gross = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  const stop = await queryOne<{ lost_s: string }>(
    `SELECT COALESCE(SUM(COALESCE(duration_min, 0) * 60), 0)::text AS lost_s
     FROM txn.stoppage_entry WHERE run_id = $1`,
    [runId],
  );
  const lost = Math.floor(Number(stop?.lost_s ?? 0));
  const net = Math.max(0, gross - lost);
  await query(`UPDATE txn.prod_tm_run SET gross_runtime_s = $2, net_runtime_s = $3 WHERE id = $1`, [
    runId,
    gross,
    net,
  ]);
}

export async function holdRun(runId: string, remark?: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'DRAFT') throw new Error('Only DRAFT runs can be held');
  await query(`UPDATE txn.prod_tm_run SET hold_status = 'HELD' WHERE id = $1`, [runId]);
  await markQueueHoldByRunId(runId);
  if (remark) await appendRemark(runId, remark, 'HOLD');
  return getRun(runId);
}

export async function resumeRun(runId: string, remark?: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  await query(`UPDATE txn.prod_tm_run SET hold_status = 'NONE' WHERE id = $1`, [runId]);
  await markQueueInProgressByRunId(runId);
  if (remark) await appendRemark(runId, remark, 'RESUME');
  return getRun(runId);
}

export async function appendRemark(runId: string, remark: string, kind = 'REMARK') {
  await query(
    `UPDATE txn.prod_tm_run SET
      remarks = $2,
      remarks_log = COALESCE(remarks_log, '[]'::jsonb) || $3::jsonb
     WHERE id = $1`,
    [runId, remark, JSON.stringify([{ at: new Date().toISOString(), kind, remark }])],
  );
  return getRun(runId);
}

export async function startProduction(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.holdStatus === 'HELD') throw new Error('Run is on HOLD — resume first');

  if (run.runState === 'RUNNING') {
    // already running — ensure collector
  } else if (run.runState === 'FIRST_OFF_PENDING' && run.firstOffStatus === 'PASS') {
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
      [runId],
    );
  } else {
    throw new Error(`Cannot start from state ${run.runState}`);
  }
  const { startCollectorForRun } = await import('../collector/CollectorRunner');
  startCollectorForRun(runId);
  return getRun(runId);
}

export async function endProduction(runId: string, remark?: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  const state = run.runState as MillRunState;
  if (!['RUNNING', 'STOPPAGE', 'ROLL_CHANGE', 'SETUP', 'FIRST_OFF_PENDING'].includes(state)) {
    throw new Error(`Cannot end from state ${state}`);
  }
  if (remark?.trim()) {
    await appendRemark(runId, remark.trim(), 'END');
  }
  await updateRuntimeRollups(runId);
  await updateRunState(runId, transition(state, 'RUN_CLOSED'));
  const { stopCollectorForRun } = await import('../collector/CollectorRunner');
  stopCollectorForRun(runId);
  return getRun(runId);
}

export async function rollChange(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.runState !== 'RUNNING') throw new Error('ROLL_CHANGE requires RUNNING');
  await updateRunState(runId, transition('RUNNING', 'ROLL_CHANGE'));
  return getRun(runId);
}

export async function listRuns(millCode = 'A-59', limit = 50) {
  const rows = await query<RunRow>(
    `SELECT * FROM txn.prod_tm_run WHERE tenant_id = $1 AND mill_code = $2
     ORDER BY created_at DESC LIMIT $3`,
    [config.tenantId, millCode, limit],
  );
  return Promise.all(
    rows.map(async (r) => {
      const size = r.size as { thkMm?: number };
      const defaults = await resolveRunDefaults(r.size_key, size.thkMm ?? 0, r.grade_code ?? '1010');
      return formatRun(r, defaults ?? undefined);
    }),
  );
}

export async function claimHttpIdempotency(scope: string, key: string): Promise<boolean> {
  try {
    await query(`INSERT INTO txn.idempotency_key (scope, key) VALUES ($1, $2)`, [scope, key]);
    return true;
  } catch {
    return false;
  }
}
