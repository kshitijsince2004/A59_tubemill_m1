import { query, queryOne } from '../db/pool';
import { config } from '../config';
import {
  paintColourForGrade,
  dieConditionBlocksIssue,
  tableAInspectionIssues,
} from '@a59/shared';

function mapCapability(row) {
  if (!row) return null;
  return {
    benchCode: row.bench_code,
    tonnageT: row.tonnage_t != null ? Number(row.tonnage_t) : null,
    label: row.label,
    odMinMm: row.od_min_mm != null ? Number(row.od_min_mm) : null,
    odMaxMm: row.od_max_mm != null ? Number(row.od_max_mm) : null,
    mhOdMinMm: row.mh_od_min_mm != null ? Number(row.mh_od_min_mm) : null,
    mhOdMaxMm: row.mh_od_max_mm != null ? Number(row.mh_od_max_mm) : null,
    mhThkMinMm: row.mh_thk_min_mm != null ? Number(row.mh_thk_min_mm) : null,
    mhThkMaxMm: row.mh_thk_max_mm != null ? Number(row.mh_thk_max_mm) : null,
    finOdMinMm: row.fin_od_min_mm != null ? Number(row.fin_od_min_mm) : null,
    finOdMaxMm: row.fin_od_max_mm != null ? Number(row.fin_od_max_mm) : null,
    finThkMinMm: row.fin_thk_min_mm != null ? Number(row.fin_thk_min_mm) : null,
    finThkMaxMm: row.fin_thk_max_mm != null ? Number(row.fin_thk_max_mm) : null,
  };
}

function mapLot(row) {
  return {
    id: row.id,
    lotNo: row.lot_no,
    workOrderNo: row.work_order_no,
    customerCode: row.customer_code,
    customerName: row.customer_name,
    gradeCode: row.grade_code,
    size: row.size,
    benchCode: row.bench_code,
    drawPass: row.draw_pass,
    inputTubeRef: row.input_tube_ref,
    operatorRef: row.operator_ref,
    finalSize: row.final_size,
    fromSize: row.from_size,
    toSize: row.to_size,
    drawPlanLenMm: row.draw_plan_len_mm != null ? Number(row.draw_plan_len_mm) : null,
    stage: row.stage,
    acceptedPcs: row.accepted_pcs != null ? Number(row.accepted_pcs) : null,
    rejectedPcs: row.rejected_pcs != null ? Number(row.rejected_pcs) : null,
    inputNos: row.input_nos != null ? Number(row.input_nos) : null,
    drawnMetre: row.drawn_metre != null ? Number(row.drawn_metre) : null,
    pullLoadT: row.pull_load_t != null ? Number(row.pull_load_t) : null,
    cycleTimeS: row.cycle_time_s != null ? Number(row.cycle_time_s) : null,
    breakdownRemark: row.breakdown_remark,
    tagNo: row.tag_no,
    paintColour: row.paint_colour,
    swageEndMm: row.swage_end_mm != null ? Number(row.swage_end_mm) : null,
    specialControl: row.special_control,
    shiftRef: row.shift_ref,
    prodDate: row.prod_date,
    status: row.status,
    dataSource: row.data_source,
    remarks: row.remarks,
    supervisorRef: row.supervisor_ref ?? null,
    shiftInchargeRef: row.shift_incharge_ref ?? null,
    materialLotId: row.material_lot_id,
    upstreamHandoffId: row.upstream_handoff_id,
    fromOdMm: row.from_od_mm != null ? Number(row.from_od_mm) : null,
    fromThMm: row.from_th_mm != null ? Number(row.from_th_mm) : null,
    fromLenMm: row.from_len_mm != null ? Number(row.from_len_mm) : null,
    toOdMm: row.to_od_mm != null ? Number(row.to_od_mm) : null,
    toIdMm: row.to_id_mm != null ? Number(row.to_id_mm) : null,
    toThMm: row.to_th_mm != null ? Number(row.to_th_mm) : null,
    toLenMm: row.to_len_mm != null ? Number(row.to_len_mm) : null,
    finalOdMm: row.final_od_mm != null ? Number(row.final_od_mm) : null,
    finalIdMm: row.final_id_mm != null ? Number(row.final_id_mm) : null,
    finalThMm: row.final_th_mm != null ? Number(row.final_th_mm) : null,
    finalLenMm: row.final_len_mm != null ? Number(row.final_len_mm) : null,
    passType: row.pass_type ?? row.stage,
    acceptedMt: row.accepted_mt != null ? Number(row.accepted_mt) : null,
    productionStartedAt: row.production_started_at ?? null,
    productionEndedAt: row.production_ended_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    createdBy: row.created_by,
  };
}

function inBand(value, lo, hi) {
  if (value == null || Number.isNaN(Number(value))) return true;
  if (lo == null || hi == null || Number.isNaN(Number(lo)) || Number.isNaN(Number(hi))) return true;
  const n = Number(value);
  return n >= Number(lo) && n <= Number(hi);
}

export async function getBenchCapability(benchCode) {
  const row = await queryOne(
    `SELECT * FROM master.db_bench_capability WHERE tenant_id = $1 AND bench_code = $2`,
    [config.tenantId, benchCode]
  );
  return mapCapability(row);
}

export async function listBenchCapabilities() {
  const rows = await query(
    `SELECT * FROM master.db_bench_capability WHERE tenant_id = $1 ORDER BY tonnage_t, bench_code`,
    [config.tenantId]
  );
  return rows.map(mapCapability);
}

export async function getPaintColour(gradeCode) {
  if (!gradeCode) return null;
  const row = await queryOne(
    `SELECT paint_colour FROM master.db_paint_colour WHERE tenant_id = $1 AND grade_code = $2`,
    [config.tenantId, String(gradeCode).trim()]
  );
  if (row?.paint_colour) return row.paint_colour;
  return paintColourForGrade(gradeCode);
}

export async function getSwageEndSpec(tonnageT) {
  if (tonnageT == null || Number.isNaN(Number(tonnageT))) return null;
  const row = await queryOne(
    `SELECT * FROM master.db_swage_end_spec
     WHERE tenant_id = $1 AND tonnage_min <= $2 AND tonnage_max >= $2
     ORDER BY tonnage_min LIMIT 1`,
    [config.tenantId, Number(tonnageT)]
  );
  if (!row) return null;
  return {
    tonnageMin: Number(row.tonnage_min),
    tonnageMax: Number(row.tonnage_max),
    swageSpecMm: row.length_nom_mm != null ? Number(row.length_nom_mm) : null,
    swageTol: row.length_tol_mm != null ? Number(row.length_tol_mm) : null,
    swageEndMinMm: row.length_min_mm != null ? Number(row.length_min_mm) : null,
    swageEndMaxMm: row.length_max_mm != null ? Number(row.length_max_mm) : null,
    label: row.label,
  };
}

/** Build validation master envelope for a bench + grade. */
export async function buildDrwValidationMaster(benchCode, gradeCode) {
  const cap = benchCode ? await getBenchCapability(benchCode) : null;
  const paint = gradeCode ? await getPaintColour(gradeCode) : null;
  const swage = cap?.tonnageT != null ? await getSwageEndSpec(cap.tonnageT) : null;
  return {
    ...(cap ?? {}),
    paintColour: paint,
    ...(swage ?? {}),
  };
}

/**
 * Suggest benches whose finished (or MH) OD band covers targetOd.
 * Warning-only eligibility — never a hard block.
 */
export async function suggestDbBench({ odMm, thkMm, fromOdMm, fromThMm } = {}) {
  const caps = await listBenchCapabilities();
  const targetOd = odMm ?? null;
  const targetThk = thkMm ?? null;
  const mhOd = fromOdMm ?? null;
  const mhThk = fromThMm ?? null;

  const scored = caps.map((c) => {
    const warnings = [];
    let score = 0;
    if (targetOd != null && !inBand(targetOd, c.finOdMinMm, c.finOdMaxMm)) {
      if (c.finOdMinMm != null && c.finOdMaxMm != null) {
        warnings.push(`Finished OD ${targetOd} outside ${c.finOdMinMm}–${c.finOdMaxMm}`);
        score += 10;
      }
    } else if (targetOd != null) {
      score -= 1;
    }
    if (targetThk != null && !inBand(targetThk, c.finThkMinMm, c.finThkMaxMm)) {
      if (c.finThkMinMm != null && c.finThkMaxMm != null) {
        warnings.push(`Finished THK ${targetThk} outside ${c.finThkMinMm}–${c.finThkMaxMm}`);
        score += 5;
      }
    }
    if (mhOd != null && !inBand(mhOd, c.mhOdMinMm, c.mhOdMaxMm)) {
      if (c.mhOdMinMm != null && c.mhOdMaxMm != null) {
        warnings.push(`Mother hollow OD ${mhOd} outside ${c.mhOdMinMm}–${c.mhOdMaxMm}`);
        score += 8;
      }
    }
    if (mhThk != null && !inBand(mhThk, c.mhThkMinMm, c.mhThkMaxMm)) {
      if (c.mhThkMinMm != null && c.mhThkMaxMm != null) {
        warnings.push(`Mother hollow THK ${mhThk} outside ${c.mhThkMinMm}–${c.mhThkMaxMm}`);
        score += 4;
      }
    }
    return {
      ...c,
      eligible: warnings.length === 0,
      warnings,
      score,
    };
  });

  scored.sort((a, b) => a.score - b.score || (a.tonnageT ?? 0) - (b.tonnageT ?? 0));
  const suggested = scored[0] ?? null;
  return { suggested, benches: scored };
}

export async function checkDbEligibility(benchCode, dims = {}) {
  const result = await suggestDbBench(dims);
  const match = result.benches.find((b) => b.benchCode === benchCode);
  if (!match) {
    return {
      benchCode,
      eligible: false,
      warnings: [`Unknown bench ${benchCode}`],
    };
  }
  return {
    benchCode,
    eligible: match.eligible,
    warnings: match.warnings,
    capability: match,
  };
}

export async function listDrwLots(filter = {}) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filter.status) {
    clauses.push(`status = $${i++}`);
    params.push(filter.status);
  }
  if (filter.benchCode) {
    clauses.push(`bench_code = $${i++}`);
    params.push(filter.benchCode);
  }
  if (filter.workOrderNo) {
    clauses.push(`work_order_no ILIKE $${i++}`);
    params.push(`%${filter.workOrderNo}%`);
  }
  if (filter.drawPass) {
    clauses.push(`draw_pass = $${i++}`);
    params.push(filter.drawPass);
  }
  if (filter.fromDate) {
    clauses.push(`prod_date >= $${i++}`);
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    clauses.push(`prod_date <= $${i++}`);
    params.push(filter.toDate);
  }
  const rows = await query(
    `SELECT * FROM txn.prod_db_lot WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return rows.map(mapLot);
}

export async function getDrwLot(id) {
  const row = await queryOne(`SELECT * FROM txn.prod_db_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!row) return null;
  const [checks, inspections, issues, usages, swages] = await Promise.all([
    query(`SELECT * FROM txn.db_shift_check WHERE lot_id = $1 ORDER BY created_at`, [id]),
    query(`SELECT * FROM txn.db_inspection WHERE lot_id = $1 ORDER BY created_at`, [id]),
    query(`SELECT * FROM txn.db_tooling_issue WHERE lot_id = $1 ORDER BY created_at`, [id]),
    query(`SELECT * FROM txn.db_tooling_usage WHERE lot_id = $1 ORDER BY created_at`, [id]),
    query(`SELECT * FROM txn.prod_db_swage WHERE linked_db_lot_id = $1 ORDER BY created_at`, [id]),
  ]);
  return {
    ...mapLot(row),
    shiftChecks: checks,
    inspections,
    toolingIssues: issues,
    toolingUsages: usages,
    swages,
  };
}

function resolveFlatDims(input) {
  const fromOd = input.fromOdMm ?? input.fromSize?.odMm ?? null;
  const fromTh = input.fromThMm ?? input.fromSize?.thkMm ?? null;
  const fromLen = input.fromLenMm ?? input.fromSize?.lengthMm ?? null;
  const toOd = input.toOdMm ?? input.toSize?.odMm ?? null;
  const toId = input.toIdMm ?? input.toSize?.idMm ?? null;
  const toTh = input.toThMm ?? input.toSize?.thkMm ?? null;
  const toLen = input.toLenMm ?? input.toSize?.lengthMm ?? null;
  const finalOd = input.finalOdMm ?? input.finalSize?.odMm ?? null;
  const finalId = input.finalIdMm ?? input.finalSize?.idMm ?? null;
  const finalTh = input.finalThMm ?? input.finalSize?.thkMm ?? null;
  const finalLen = input.finalLenMm ?? input.finalSize?.lengthMm ?? null;
  return { fromOd, fromTh, fromLen, toOd, toId, toTh, toLen, finalOd, finalId, finalTh, finalLen };
}

async function resolvePaint(input) {
  if (input.paintColour) return input.paintColour;
  return getPaintColour(input.gradeCode);
}

/** Find existing lot for multi-pass dedup: same WO + pass + bench. */
export async function findDrwLotByPassKey(workOrderNo, drawPass, benchCode) {
  if (!workOrderNo || !drawPass || !benchCode) return null;
  const row = await queryOne(
    `SELECT * FROM txn.prod_db_lot
     WHERE tenant_id = $1 AND work_order_no = $2 AND draw_pass = $3 AND bench_code = $4
       AND status <> 'APPROVED'
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, workOrderNo, drawPass, benchCode]
  );
  return row ? mapLot(row) : null;
}

export async function createDrwLot(input) {
  const dims = resolveFlatDims(input);
  const paint = await resolvePaint(input);
  const row = await queryOne(
    `INSERT INTO txn.prod_db_lot (
      tenant_id, lot_no, work_order_no, customer_code, customer_name, grade_code, size, bench_code, draw_pass,
      input_tube_ref, operator_ref, final_size, from_size, to_size, draw_plan_len_mm, stage,
      accepted_pcs, rejected_pcs, input_nos, drawn_metre, pull_load_t, cycle_time_s, breakdown_remark, tag_no,
      paint_colour, swage_end_mm, special_control,
      shift_ref, prod_date, status, data_source, remarks, created_by,
      from_od_mm, from_th_mm, from_len_mm, to_od_mm, to_id_mm, to_th_mm, to_len_mm,
      final_od_mm, final_id_mm, final_th_mm, final_len_mm, pass_type, accepted_mt,
      material_lot_id, upstream_handoff_id, supervisor_ref, shift_incharge_ref
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
      $25,$26,$27,$28,$29,$30,$31,$32,$33,
      $34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50
    ) RETURNING *`,
    [
      config.tenantId,
      input.lotNo,
      input.workOrderNo ?? null,
      input.customerCode ?? null,
      input.customerName ?? null,
      input.gradeCode ?? null,
      JSON.stringify(input.size ?? {}),
      input.benchCode,
      input.drawPass ?? '1ST',
      input.inputTubeRef ?? null,
      input.operatorRef ?? null,
      JSON.stringify(input.finalSize ?? {}),
      JSON.stringify(input.fromSize ?? {}),
      JSON.stringify(input.toSize ?? {}),
      input.drawPlanLenMm ?? null,
      input.stage ?? input.passType ?? null,
      input.acceptedPcs ?? null,
      input.rejectedPcs ?? null,
      input.inputNos ?? null,
      input.drawnMetre ?? null,
      input.pullLoadT ?? null,
      input.cycleTimeS ?? null,
      input.breakdownRemark ?? null,
      input.tagNo ?? null,
      paint,
      input.swageEndMm ?? null,
      input.specialControl ?? null,
      input.shiftRef ?? null,
      input.prodDate ?? null,
      input.status ?? 'DRAFT',
      input.dataSource ?? 'MANUAL',
      input.remarks ?? null,
      input.createdBy ?? null,
      dims.fromOd,
      dims.fromTh,
      dims.fromLen,
      dims.toOd,
      dims.toId,
      dims.toTh,
      dims.toLen,
      dims.finalOd,
      dims.finalId,
      dims.finalTh,
      dims.finalLen,
      input.passType ?? input.stage ?? null,
      input.acceptedMt ?? null,
      input.materialLotId ?? null,
      input.upstreamHandoffId ?? null,
      input.supervisorRef ?? null,
      input.shiftInchargeRef ?? null,
    ]
  );
  try {
    const { activeShiftLogId } = await import('./handover/productionGuard.js');
    const sid = await activeShiftLogId(input.benchCode);
    if (sid && row?.id) {
      await query(`UPDATE txn.prod_db_lot SET shift_log_id = $1 WHERE id = $2 AND tenant_id = $3`, [
        sid,
        row.id,
        config.tenantId,
      ]);
      row.shift_log_id = sid;
    }
  } catch {
    /* best-effort */
  }
  return mapLot(row);
}

export async function updateDrwLot(id, input) {
  const existing = await queryOne(`SELECT * FROM txn.prod_db_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('Draw lot not found');
  if (existing.status === 'APPROVED') throw new Error('Cannot edit APPROVED lot');

  const dims = resolveFlatDims(input);
  const paint =
    input.paintColour !== undefined
      ? input.paintColour
      : input.gradeCode
        ? await resolvePaint(input)
        : undefined;

  const row = await queryOne(
    `UPDATE txn.prod_db_lot SET
      work_order_no = COALESCE($3, work_order_no),
      customer_code = COALESCE($4, customer_code),
      customer_name = COALESCE($5, customer_name),
      grade_code = COALESCE($6, grade_code),
      size = COALESCE($7, size),
      bench_code = COALESCE($8, bench_code),
      draw_pass = COALESCE($9, draw_pass),
      input_tube_ref = COALESCE($10, input_tube_ref),
      operator_ref = COALESCE($11, operator_ref),
      final_size = COALESCE($12, final_size),
      from_size = COALESCE($13, from_size),
      to_size = COALESCE($14, to_size),
      draw_plan_len_mm = COALESCE($15, draw_plan_len_mm),
      stage = COALESCE($16, stage),
      accepted_pcs = COALESCE($17, accepted_pcs),
      rejected_pcs = COALESCE($18, rejected_pcs),
      input_nos = COALESCE($19, input_nos),
      drawn_metre = COALESCE($20, drawn_metre),
      pull_load_t = COALESCE($21, pull_load_t),
      cycle_time_s = COALESCE($22, cycle_time_s),
      breakdown_remark = COALESCE($23, breakdown_remark),
      tag_no = COALESCE($24, tag_no),
      paint_colour = COALESCE($25, paint_colour),
      swage_end_mm = COALESCE($26, swage_end_mm),
      special_control = COALESCE($27, special_control),
      shift_ref = COALESCE($28, shift_ref),
      prod_date = COALESCE($29, prod_date),
      data_source = COALESCE($30, data_source),
      remarks = COALESCE($31, remarks),
      from_od_mm = COALESCE($32, from_od_mm),
      from_th_mm = COALESCE($33, from_th_mm),
      from_len_mm = COALESCE($34, from_len_mm),
      to_od_mm = COALESCE($35, to_od_mm),
      to_id_mm = COALESCE($36, to_id_mm),
      to_th_mm = COALESCE($37, to_th_mm),
      to_len_mm = COALESCE($38, to_len_mm),
      final_od_mm = COALESCE($39, final_od_mm),
      final_id_mm = COALESCE($40, final_id_mm),
      final_th_mm = COALESCE($41, final_th_mm),
      final_len_mm = COALESCE($42, final_len_mm),
      pass_type = COALESCE($43, pass_type),
      accepted_mt = COALESCE($44, accepted_mt),
      material_lot_id = COALESCE($45, material_lot_id),
      upstream_handoff_id = COALESCE($46, upstream_handoff_id),
      supervisor_ref = COALESCE($47, supervisor_ref),
      shift_incharge_ref = COALESCE($48, shift_incharge_ref),
      updated_at = now()
    WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [
      id,
      config.tenantId,
      input.workOrderNo ?? null,
      input.customerCode ?? null,
      input.customerName ?? null,
      input.gradeCode ?? null,
      input.size != null ? JSON.stringify(input.size) : null,
      input.benchCode ?? null,
      input.drawPass ?? null,
      input.inputTubeRef ?? null,
      input.operatorRef ?? null,
      input.finalSize != null ? JSON.stringify(input.finalSize) : null,
      input.fromSize != null ? JSON.stringify(input.fromSize) : null,
      input.toSize != null ? JSON.stringify(input.toSize) : null,
      input.drawPlanLenMm ?? null,
      input.stage ?? input.passType ?? null,
      input.acceptedPcs ?? null,
      input.rejectedPcs ?? null,
      input.inputNos ?? null,
      input.drawnMetre ?? null,
      input.pullLoadT ?? null,
      input.cycleTimeS ?? null,
      input.breakdownRemark ?? null,
      input.tagNo ?? null,
      paint ?? null,
      input.swageEndMm ?? null,
      input.specialControl ?? null,
      input.shiftRef ?? null,
      input.prodDate ?? null,
      input.dataSource ?? null,
      input.remarks ?? null,
      dims.fromOd,
      dims.fromTh,
      dims.fromLen,
      dims.toOd,
      dims.toId,
      dims.toTh,
      dims.toLen,
      dims.finalOd,
      dims.finalId,
      dims.finalTh,
      dims.finalLen,
      input.passType ?? input.stage ?? null,
      input.acceptedMt ?? null,
      input.materialLotId ?? null,
      input.upstreamHandoffId ?? null,
      input.supervisorRef ?? null,
      input.shiftInchargeRef ?? null,
    ]
  );
  return mapLot(row);
}

export async function setDrwStatus(id, status) {
  if (status === 'SUBMITTED') {
    const lot = await getDrwLot(id);
    if (!lot) throw new Error('Draw lot not found');
    const issues = tableAInspectionIssues(lot.specialControl ?? 'MASS', lot.inspections ?? []);
    if (issues.length) {
      const err = new Error(issues.map((i) => i.message).join('; '));
      err.issues = issues;
      throw err;
    }
  }

  const row = await queryOne(
    `UPDATE txn.prod_db_lot SET status = $3, updated_at = now()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [id, config.tenantId, status]
  );
  if (!row) throw new Error('Draw lot not found');
  if (status === 'APPROVED') {
    try {
      const { enqueueDrwWriteback } = await import('../erp/ErpWritebackService.js');
      await enqueueDrwWriteback(id);
    } catch (err) {
      console.warn('[erp] DRW writeback enqueue failed:', err instanceof Error ? err.message : err);
    }
    try {
      const { publishDrwMaterialLots } = await import('./GenealogyService.js');
      await publishDrwMaterialLots(id);
    } catch (err) {
      console.warn('[genealogy] DRW material lot publish failed:', err instanceof Error ? err.message : err);
    }
  }
  return mapLot(row);
}

export async function addShiftCheck(input) {
  return queryOne(
    `INSERT INTO txn.db_shift_check (
      tenant_id, lot_id, bench_code, check_date, shift_ref,
      clean_ok, die_plug_ok, lube_ok, pressure_ok, input_lube_ok, draw_speed_set, noise_ok,
      remarks, created_by
    ) VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      config.tenantId,
      input.lotId ?? null,
      input.benchCode,
      input.checkDate ?? null,
      input.shiftRef ?? null,
      input.cleanOk ?? null,
      input.diePlugOk ?? null,
      input.lubeOk ?? null,
      input.pressureOk ?? null,
      input.inputLubeOk ?? null,
      input.drawSpeedSet ?? null,
      input.noiseOk ?? null,
      input.remarks ?? null,
      input.createdBy ?? null,
    ]
  );
}

export async function addInspection(input) {
  const inspectionType = input.inspectionType ?? null;
  let firstOffOk = input.firstOffOk ?? null;
  let lastOffOk = input.lastOffOk ?? null;
  if (inspectionType === 'FIRST_OFF' && firstOffOk == null) firstOffOk = true;
  if (inspectionType === 'LAST_OFF' && lastOffOk == null) lastOffOk = true;

  return queryOne(
    `INSERT INTO txn.db_inspection (
      tenant_id, lot_id, inspection_type, od_mm, id_mm, thk_mm, len_mm,
      form_dev_mm, surface_ra, surface, surface_ok, first_off_ok, last_off_ok, refirstoff_ok,
      disposition, special_control, remarks
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [
      config.tenantId,
      input.lotId,
      inspectionType,
      input.odMm ?? null,
      input.idMm ?? null,
      input.thkMm ?? null,
      input.lenMm ?? null,
      input.formDevMm ?? null,
      input.surfaceRa ?? null,
      input.surface ?? null,
      input.surfaceOk ?? null,
      firstOffOk,
      lastOffOk,
      input.refirstoffOk ?? null,
      input.disposition ?? null,
      input.specialControl ?? null,
      input.remarks ?? null,
    ]
  );
}

export async function assertDrwInspectionsDispositioned(lotId) {
  const rows = await query(`SELECT id, disposition FROM txn.db_inspection WHERE lot_id = $1 AND tenant_id = $2`,
    [lotId, config.tenantId]
  );
  if (!rows.length) return;
  const open = rows.filter((r) => !r.disposition || r.disposition === '');
  if (open.length) {
    const err = new Error('All inspections require disposition (OK/HOLD/REJECT/REWORK) before approve');
    err.status = 422;
    throw err;
  }
}

export async function updateInspectionDisposition(inspectionId, disposition, lotId) {
  const allowed = ['OK', 'HOLD', 'REJECT', 'REWORK'];
  if (!allowed.includes(String(disposition))) {
    throw new Error('disposition must be OK|HOLD|REJECT|REWORK');
  }
  return queryOne(
    `UPDATE txn.db_inspection SET disposition = $2
     WHERE id = $1 AND lot_id = $3 AND tenant_id = $4
     RETURNING *`,
    [inspectionId, disposition, lotId, config.tenantId]
  );
}

export async function addToolingIssue(input) {
  if (dieConditionBlocksIssue(input.dieCondition, input.plugCondition)) {
    throw new Error('Die/plug has crack, score, or scratch — reject full set (issue blocked)');
  }
  return queryOne(
    `INSERT INTO txn.db_tooling_issue (
      tenant_id, lot_id, issue_size, die_code, stage, die_size_mm, actual_od_1stoff_mm,
      die_condition, plug_stage, plug_size_mm, plug_condition
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      config.tenantId,
      input.lotId,
      input.issueSize ?? null,
      input.dieCode ?? null,
      input.stage ?? null,
      input.dieSizeMm ?? null,
      input.actualOd1stoffMm ?? null,
      input.dieCondition ?? null,
      input.plugStage ?? null,
      input.plugSizeMm ?? null,
      input.plugCondition ?? null,
    ]
  );
}

export async function addToolingUsage(input) {
  return queryOne(
    `INSERT INTO txn.db_tooling_usage (
      tenant_id, die_code, lot_id, use_date, prev_draw_od_mm, tubes_produced, input_size,
      die_polish, oversized, disposition, remarks
    ) VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      config.tenantId,
      input.dieCode,
      input.lotId ?? null,
      input.useDate ?? null,
      input.prevDrawOdMm ?? null,
      input.tubesProduced ?? null,
      JSON.stringify(input.inputSize ?? {}),
      input.diePolish ?? null,
      input.oversized ?? null,
      input.disposition ?? null,
      input.remarks ?? null,
    ]
  );
}

export async function createSwage(input) {
  return queryOne(
    `INSERT INTO txn.prod_db_swage (
      tenant_id, lot_no, linked_db_lot_id, swg_machine, work_order_no, customer_code, grade_code,
      size, swg_die, draw_size, tag_len_mm, len_after_die_mm, pieces, tag_no,
      shift_ref, prod_date, data_source, remarks, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [
      config.tenantId,
      input.lotNo,
      input.linkedDbLotId ?? null,
      input.swgMachine ?? null,
      input.workOrderNo ?? null,
      input.customerCode ?? null,
      input.gradeCode ?? null,
      JSON.stringify(input.size ?? {}),
      input.swgDie ?? null,
      JSON.stringify(input.drawSize ?? {}),
      input.tagLenMm ?? null,
      input.lenAfterDieMm ?? null,
      input.pieces ?? null,
      input.tagNo ?? null,
      input.shiftRef ?? null,
      input.prodDate ?? null,
      input.dataSource ?? 'MANUAL',
      input.remarks ?? null,
      input.createdBy ?? null,
    ]
  );
}

export async function listDrawBenches() {
  return query(
    `SELECT m.machine_code, m.label, m.process_code,
            c.tonnage_t, c.mh_od_min_mm, c.mh_od_max_mm, c.fin_od_min_mm, c.fin_od_max_mm
     FROM master.machine m
     LEFT JOIN master.db_bench_capability c
       ON c.bench_code = m.machine_code AND c.tenant_id = m.tenant_id
     WHERE m.tenant_id = $1 AND m.process_code IN ('DRW','SWG')
     ORDER BY m.machine_code`,
    [config.tenantId]
  );
}

function parseSizeJson(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function formatSizeLabel(size) {
  const s = parseSizeJson(size);
  const parts = [];
  if (s.odMm != null) parts.push(`OD ${s.odMm}`);
  if (s.idMm != null) parts.push(`ID ${s.idMm}`);
  if (s.thkMm != null) parts.push(`THK ${s.thkMm}`);
  if (s.lengthMm != null) parts.push(`L ${s.lengthMm}`);
  return parts.length ? parts.join(' · ') : null;
}

function currentShiftRef() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

function deriveDrwBoardStatus(lot, openStoppage) {
  if (openStoppage) return 'STOPPAGE';
  if (!lot) return 'IDLE';
  if (lot.status === 'APPROVED' || lot.status === 'SUBMITTED') return 'COMPLETE';
  if (lot.status === 'HOLD') return 'HOLD';
  if (lot.production_ended_at) return 'COMPLETE';
  if (lot.status === 'DRAFT' && lot.production_started_at && !lot.production_ended_at) {
    return 'RUNNING';
  }
  if (lot.status === 'DRAFT' && lot.work_order_no) return 'PREPARING';
  return 'IDLE';
}

/**
 * Start production clock on a DRAFT lot (STP-shaped).
 * Idempotent if already started and not ended.
 */
export async function startDrwProduction(id) {
  const existing = await queryOne(`SELECT * FROM txn.prod_db_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('Draw Bench lot not found');
  if (existing.status === 'APPROVED' || existing.status === 'SUBMITTED') {
    throw new Error('Cannot start a submitted or approved lot');
  }
  if (existing.status === 'HOLD') throw new Error('Cannot start a held lot');
  if (existing.production_ended_at) throw new Error('Production already ended');
  if (!existing.work_order_no) throw new Error('Work order required before Start');
  if (existing.production_started_at) return mapLot(existing);

  const openStop = await queryOne(
    `SELECT id FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND process_code = 'DRW' AND source_id = $2 AND is_open = true
     LIMIT 1`,
    [config.tenantId, id]
  );
  if (openStop) throw new Error('End open stoppage before Start');

  if (!existing.shift_log_id) {
    try {
      const { activeShiftLogId } = await import('./handover/productionGuard.js');
      const sid = await activeShiftLogId(existing.bench_code);
      if (sid) {
        await query(
          `UPDATE txn.prod_db_lot SET shift_log_id = $1, updated_at = now()
           WHERE id = $2 AND tenant_id = $3 AND shift_log_id IS NULL`,
          [sid, id, config.tenantId]
        );
      }
    } catch {
      /* best-effort */
    }
  }

  const row = await queryOne(
    `UPDATE txn.prod_db_lot SET production_started_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [id, config.tenantId]
  );
  return mapLot(row);
}

/**
 * End production clock. Closes any open stoppage. Does not change lot status
 * (Submit / Approve remain separate).
 */
export async function endDrwProduction(id) {
  const existing = await queryOne(`SELECT * FROM txn.prod_db_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('Draw Bench lot not found');
  if (!existing.production_started_at) throw new Error('Start production before End');
  if (existing.production_ended_at) return mapLot(existing);

  try {
    const { closeProcessStoppage } = await import('./ProcessStoppageService.js');
    await closeProcessStoppage('DRW', id);
  } catch {
    /* no open stoppage */
  }

  const row = await queryOne(
    `UPDATE txn.prod_db_lot SET production_ended_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [id, config.tenantId]
  );
  return mapLot(row);
}

/**
 * Per-bench operator board: one row per DRW machine with derived status.
 */
export async function getDrawBenchBoard() {
  const machines = await listDrawBenches();
  const lots = await query(
    `SELECT DISTINCT ON (bench_code) *
     FROM txn.prod_db_lot
     WHERE tenant_id = $1
     ORDER BY bench_code,
       CASE
         WHEN status IN ('DRAFT','HOLD') THEN 0
         WHEN status = 'SUBMITTED' THEN 1
         ELSE 2
       END,
       created_at DESC`,
    [config.tenantId]
  );
  const lotByBench = new Map(lots.map((r) => [r.bench_code, r]));
  const lotIds = lots.map((r) => r.id).filter(Boolean);
  let stoppages = [];
  if (lotIds.length) {
    stoppages = await query(
      `SELECT source_id, stoppage_code, from_time, reason, is_open
       FROM txn.stoppage_entry
       WHERE tenant_id = $1 AND process_code = 'DRW' AND is_open = true
         AND source_id = ANY($2::uuid[])`,
      [config.tenantId, lotIds]
    );
  }
  const stopByLot = new Map(stoppages.map((s) => [String(s.source_id), s]));

  return machines
    .filter((m) => String(m.process_code) === 'DRW' && String(m.machine_code).startsWith('DB'))
    .map((m) => {
      const code = m.machine_code;
      const lot = lotByBench.get(code) ?? null;
      const openStoppage = lot ? stopByLot.get(String(lot.id)) ?? null : null;
      const boardStatus = deriveDrwBoardStatus(lot, openStoppage);
      const accepted = lot?.accepted_pcs != null ? Number(lot.accepted_pcs) : null;
      const planned = lot?.input_nos != null ? Number(lot.input_nos) : null;
      return {
        benchCode: code,
        label: m.label || code,
        tonnageT: m.tonnage_t != null ? Number(m.tonnage_t) : null,
        status: boardStatus,
        lotId: lot?.id ?? null,
        lotStatus: lot?.status ?? null,
        lotNo: lot?.lot_no ?? null,
        runningOrder: lot
          ? {
              workOrderNo: lot.work_order_no ?? null,
              customerCode: lot.customer_code ?? null,
              customerName: lot.customer_name ?? null,
              gradeCode: lot.grade_code ?? null,
              drawPass: lot.draw_pass ?? null,
              size: formatSizeLabel(lot.final_size ?? lot.size),
            }
          : null,
        operatorRef: lot?.operator_ref ?? null,
        shiftRef: lot?.shift_ref ?? null,
        acceptedPcs: accepted,
        inputNos: planned,
        drawnMetre: lot?.drawn_metre != null ? Number(lot.drawn_metre) : null,
        progressLabel:
          planned != null && accepted != null
            ? `${accepted} / ${planned} pcs`
            : accepted != null
              ? `${accepted} pcs`
              : null,
        lastSavedAt: lot?.updated_at ?? lot?.created_at ?? null,
        plcStatus: null,
        openStoppage: openStoppage
          ? {
              code: openStoppage.stoppage_code,
              fromTime: openStoppage.from_time,
              reason: openStoppage.reason ?? null,
              sourceId: lot?.id ?? null,
            }
          : null,
      };
    });
}

/**
 * Assign a released ERP WO to a draw bench as a DRAFT prod_db_lot.
 * Reuses open lot for same WO+pass+bench (multi-pass dedup).
 */
export async function assignDrawBenchOrder(benchCode, input = {}) {
  const machines = await listDrawBenches();
  const machine = machines.find((m) => m.machine_code === benchCode && m.process_code === 'DRW');
  if (!machine) throw new Error(`Unknown draw bench ${benchCode}`);

  const workOrderNo = String(input.workOrderNo ?? '').trim();
  if (!workOrderNo) throw new Error('workOrderNo is required');

  const drawPass = String(input.drawPass ?? '1ST').toUpperCase();
  const existing = await findDrwLotByPassKey(workOrderNo, drawPass, benchCode);
  if (existing) {
    return { ...existing, deduped: true };
  }

  // One open lot per bench (matches furnace assign + IDLE/COMPLETE-gated UI).
  const openOnBench = await queryOne(
    `SELECT id, lot_no, status, work_order_no FROM txn.prod_db_lot
     WHERE tenant_id = $1 AND bench_code = $2
       AND status IN ('DRAFT', 'HOLD')
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, benchCode]
  );
  if (openOnBench) {
    throw new Error(
      `Draw bench ${benchCode} already has active lot ${openOnBench.lot_no} (${openOnBench.status})`
    );
  }

  const order = await queryOne(
    `SELECT work_order_no, customer_code, grade_code, size, qty_pieces, planned_qty, lot_no
     FROM erp.released_order
     WHERE tenant_id = $1 AND work_order_no = $2`,
    [config.tenantId, workOrderNo]
  );

  const customerCode = input.customerCode ?? order?.customer_code ?? null;
  let customerName = input.customerName ?? null;
  if (!customerName && customerCode) {
    const cust = await queryOne(
      `SELECT name FROM master.customer WHERE tenant_id = $1 AND code = $2`,
      [config.tenantId, customerCode]
    );
    customerName = cust?.name ?? null;
  }

  const size = parseSizeJson(input.size ?? order?.size ?? {});
  const gradeCode = input.gradeCode ?? order?.grade_code ?? null;
  const paintColour = input.paintColour ?? (await getPaintColour(gradeCode));
  const finalSize =
    input.finalSize ??
    (size.odMm != null || size.thkMm != null || size.lengthMm != null
      ? {
          odMm: size.odMm ?? null,
          idMm: size.idMm ?? null,
          thkMm: size.thkMm ?? null,
          lengthMm: size.lengthMm ?? null,
        }
      : {});

  // Prefill FROM only when upstream material / handoff already carries dims.
  let fromSize = input.fromSize ?? {};
  let materialLotId = input.materialLotId ?? null;
  let upstreamHandoffId = input.upstreamHandoffId ?? null;
  if (materialLotId || upstreamHandoffId) {
    let mat = null;
    if (materialLotId) {
      mat = await queryOne(`SELECT * FROM txn.material_lot WHERE id = $1 AND tenant_id = $2`, [
        materialLotId,
        config.tenantId,
      ]);
    } else if (upstreamHandoffId) {
      const handoff = await queryOne(
        `SELECT * FROM txn.process_handoff WHERE id = $1 AND tenant_id = $2`,
        [upstreamHandoffId, config.tenantId]
      );
      if (handoff?.material_lot_id) {
        materialLotId = handoff.material_lot_id;
        mat = await queryOne(`SELECT * FROM txn.material_lot WHERE id = $1 AND tenant_id = $2`, [
          materialLotId,
          config.tenantId,
        ]);
      }
    }
    if (mat?.size) {
      const upstreamSize = parseSizeJson(mat.size);
      if (
        fromSize.odMm == null &&
        fromSize.thkMm == null &&
        fromSize.lengthMm == null &&
        (upstreamSize.odMm != null || upstreamSize.thkMm != null || upstreamSize.lengthMm != null)
      ) {
        fromSize = {
          odMm: upstreamSize.odMm ?? null,
          idMm: upstreamSize.idMm ?? null,
          thkMm: upstreamSize.thkMm ?? null,
          lengthMm: upstreamSize.lengthMm ?? null,
        };
      }
    }
  }

  const lotNo =
    input.lotNo ??
    `DB-${String(benchCode).replace(/[^A-Z0-9]/gi, '')}-${Date.now().toString(36).toUpperCase()}`;

  const created = await createDrwLot({
    lotNo,
    benchCode,
    drawPass,
    workOrderNo,
    customerCode,
    customerName,
    gradeCode,
    paintColour,
    size,
    finalSize,
    fromSize,
    fromOdMm: fromSize.odMm ?? null,
    fromThMm: fromSize.thkMm ?? null,
    fromLenMm: fromSize.lengthMm ?? null,
    finalOdMm: finalSize.odMm ?? null,
    finalIdMm: finalSize.idMm ?? null,
    finalThMm: finalSize.thkMm ?? null,
    finalLenMm: finalSize.lengthMm ?? null,
    inputNos: input.inputNos ?? order?.qty_pieces ?? null,
    drawPlanLenMm: input.drawPlanLenMm ?? size.lengthMm ?? null,
    stage: input.stage ?? (drawPass === '3RD' ? 'FINAL' : 'INTER'),
    shiftRef: input.shiftRef ?? currentShiftRef(),
    prodDate: input.prodDate ?? new Date().toISOString().slice(0, 10),
    inputTubeRef: input.inputTubeRef ?? order?.lot_no ?? null,
    operatorRef: input.operatorRef ?? null,
    materialLotId,
    upstreamHandoffId,
    specialControl: input.specialControl ?? 'MASS',
    status: 'DRAFT',
    dataSource: 'MANUAL',
  });

  return { ...created, deduped: false };
}

export async function listTooling() {
  return query(`SELECT * FROM master.db_tooling WHERE tenant_id = $1 ORDER BY die_code`, [
    config.tenantId,
  ]);
}

export async function listToolingHistory(dieCode) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  if (dieCode) {
    clauses.push(`die_code = $2`);
    params.push(dieCode);
  }
  return query(
    `SELECT * FROM txn.db_tooling_usage WHERE ${clauses.join(' AND ')} ORDER BY use_date DESC, created_at DESC LIMIT 200`,
    params
  );
}

export async function listToolingIssues(filter = {}) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filter.lotId) {
    clauses.push(`lot_id = $${i++}`);
    params.push(filter.lotId);
  }
  if (filter.dieCode) {
    clauses.push(`die_code = $${i++}`);
    params.push(filter.dieCode);
  }
  return query(
    `SELECT * FROM txn.db_tooling_issue WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
    params
  );
}
