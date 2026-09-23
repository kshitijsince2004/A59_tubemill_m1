import { query, queryOne } from '../db/pool';
import { config } from '../config';







import { getRun, updateRunState } from './RunService';
import { transition } from './StateMachine';

export async function addDefect(runId, form, createdBy) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  const row = await queryOne(
    `INSERT INTO txn.tm_defect (tenant_id, run_id, defect_code, quantity_mt, pieces, remark, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
    config.tenantId,
    runId,
    form.defectCode,
    form.quantityMt ?? null,
    form.pieces ?? null,
    form.remark ?? null,
    createdBy ?? 'operator']

  );
  return row;
}

export async function listDefects(runId) {
  return query(`SELECT * FROM txn.tm_defect WHERE run_id = $1 ORDER BY created_at DESC`, [runId]);
}

export async function listDefectCodes() {
  return query(`SELECT code, label, category FROM master.defect_code WHERE tenant_id = $1 ORDER BY code`, [
  config.tenantId]
  );
}

export async function addArcWeld(form) {
  const coil = await queryOne(
    `SELECT id, run_id FROM txn.prod_tm_coil_input WHERE id = $1`,
    [form.coilInputId]
  );
  if (!coil) throw new Error('Coil input not found');
  const runId = form.runId ?? coil.run_id;
  const row = await queryOne(
    `INSERT INTO txn.tm_arcweld_log (
      tenant_id, coil_input_id, run_id, current_amp, thk_mm, grade_code, operator_ref, remark
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
    config.tenantId,
    form.coilInputId,
    runId,
    form.currentAmp ?? null,
    form.thkMm ?? null,
    form.gradeCode ?? null,
    form.operatorRef ?? null,
    form.remark ?? null]

  );
  if (row) {
    await query(`UPDATE txn.prod_tm_coil_input SET arcweld_log_id = $2 WHERE id = $1`, [form.coilInputId, row.id]);
  }
  return row;
}

export async function listArcWelds(runId) {
  return query(`SELECT * FROM txn.tm_arcweld_log WHERE run_id = $1 ORDER BY created_at DESC`, [runId]);
}

export async function addEdgeMill(runId, form) {
  const row = await queryOne(
    `INSERT INTO txn.prod_tm_edgemill (
      tenant_id, run_id, coil_input_id, od, thk_mm, grade_code,
      width_before_mm, width_after_mm, edge_condition, operator_ref, remark
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
    config.tenantId,
    runId,
    form.coilInputId ?? null,
    form.od ?? null,
    form.thkMm ?? null,
    form.gradeCode ?? null,
    form.widthBeforeMm ?? null,
    form.widthAfterMm ?? null,
    form.edgeCondition ?? null,
    form.operatorRef ?? null,
    form.remark ?? null]

  );
  if (row && form.coilInputId) {
    await query(`UPDATE txn.prod_tm_coil_input SET edgemill_id = $2 WHERE id = $1`, [form.coilInputId, row.id]);
  }
  return row;
}

export async function listEdgeMills(runId) {
  return query(`SELECT * FROM txn.prod_tm_edgemill WHERE run_id = $1 ORDER BY created_at DESC`, [runId]);
}

export async function manualStop(runId, form) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.runState === 'RUNNING') {
    await updateRunState(runId, transition('RUNNING', 'LINE_STOPPED'));
  } else if (run.runState !== 'STOPPAGE') {
    throw new Error(`Cannot manual-stop from ${run.runState}`);
  }

  const stoppageCode = form.stoppageCode?.trim();
  const reason = form.reason?.trim();
  if (!stoppageCode) throw new Error('Stoppage code is required');
  if (!reason) throw new Error('Stoppage reason is required');

  const open = await queryOne(
    `SELECT id FROM txn.stoppage_entry WHERE run_id = $1 AND is_open = true`,
    [runId]
  );
  if (!open) {
    await query(
      `INSERT INTO txn.stoppage_entry (
        tenant_id, run_id, mill_code, from_time, is_open, stoppage_code, reason, remark, category, is_planned
      ) VALUES ($1,$2,$3,now(),true,$4,$5,$6,
        (SELECT category FROM master.stoppage_code WHERE code = $4),
        COALESCE((SELECT is_planned FROM master.stoppage_code WHERE code = $4), false)
      )`,
      [
      config.tenantId,
      runId,
      run.millCode,
      stoppageCode,
      reason,
      form.remark ?? null]

    );
  } else {
    await query(
      `UPDATE txn.stoppage_entry SET
        stoppage_code = $2,
        reason = COALESCE($3, reason),
        remark = COALESCE($4, remark),
        category = (SELECT category FROM master.stoppage_code WHERE code = $2),
        is_planned = COALESCE((SELECT is_planned FROM master.stoppage_code WHERE code = $2), false)
       WHERE id = $1`,
      [open.id, stoppageCode, reason, form.remark ?? null]
    );
  }
  return getRun(runId);
}

export async function getLiveStatusSummary(millCode = 'A-59') {
  const current = await queryOne(
    `SELECT id, run_no, run_state, status, hold_status, work_order_no, size_key, grade_code, time_from
     FROM txn.prod_tm_run
     WHERE tenant_id = $1 AND mill_code = $2 AND status = 'DRAFT'
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, millCode]
  );
  const upcoming = await query(
    `SELECT id, work_order_no, bc_batch_number, customer_code, grade_code, size_key, status
     FROM ops.queue_card WHERE tenant_id = $1 AND mill_code = $2 AND status = 'Pending'
     ORDER BY id LIMIT 8`,
    [config.tenantId, millCode]
  );
  const recentStoppages = await query(
    `SELECT s.* FROM txn.stoppage_entry s
     JOIN txn.prod_tm_run r ON r.id = s.run_id
     WHERE r.tenant_id = $1 AND r.mill_code = $2
     ORDER BY s.from_time DESC LIMIT 10`,
    [config.tenantId, millCode]
  );
  const totals = await queryOne(




    `SELECT
       COALESCE(SUM(total_prime_mt),0)::text AS prime,
       COALESCE(SUM(total_scrap_mt),0)::text AS scrap,
       COUNT(*)::text AS runs
     FROM txn.prod_tm_run WHERE tenant_id = $1 AND mill_code = $2
       AND created_at::date = CURRENT_DATE`,
    [config.tenantId, millCode]
  );
  return {
    current,
    upcoming,
    recentStoppages,
    shiftSummary: {
      primeMt: Number(totals?.prime ?? 0),
      scrapMt: Number(totals?.scrap ?? 0),
      runsToday: Number(totals?.runs ?? 0)
    }
  };
}

export async function addOnlineInspection(runId, form, createdBy) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  return queryOne(
    `INSERT INTO txn.tm_online_inspection (
      tenant_id, run_id, lot_coil_ref, od_mm, thk_mm, length_mm, ovality_mm, straightness_mm,
      weld_bead_ok, flattening_ok, drifting_ok, ut_ect_result, surface_ok, gauge_ok, qa_class,
      work_order_no, remarks, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [
    config.tenantId,
    runId,
    form.lotCoilRef ?? null,
    form.odMm ?? null,
    form.thkMm ?? null,
    form.lengthMm ?? null,
    form.ovalityMm ?? null,
    form.straightnessMm ?? null,
    form.weldBeadOk ?? null,
    form.flatteningOk ?? null,
    form.driftingOk ?? null,
    form.utEctResult ?? null,
    form.surfaceOk ?? null,
    form.gaugeOk ?? null,
    form.qaClass ?? null,
    form.workOrderNo ?? null,
    form.remarks ?? null,
    createdBy ?? 'operator']

  );
}

export async function listOnlineInspections(runId) {
  return query(
    `SELECT * FROM txn.tm_online_inspection WHERE run_id = $1 ORDER BY created_at DESC`,
    [runId]
  );
}