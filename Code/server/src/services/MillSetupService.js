import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { resolveRunDefaults } from './ParamBandService.js';

function mapSetupRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    millCode: row.mill_code,
    setupType: row.setup_type,
    reason: row.reason,
    sizeKey: row.size_key,
    gradeCode: row.grade_code,
    thkMm: row.thk_mm != null ? Number(row.thk_mm) : null,
    note: row.note,
    idTool: row.id_tool,
    odTool: row.od_tool,
    boggieSize: row.boggie_size,
    impederSize: row.impeder_size,
    ferriteRod: row.ferrite_rod,
    ssRod: row.ss_rod,
    workCoilId: row.work_coil_id,
    finBlade: row.fin_blade,
    seamGuide: row.seam_guide,
    vLengthMm: row.v_length_mm != null ? Number(row.v_length_mm) : null,
    vGapMm: row.v_gap_mm != null ? Number(row.v_gap_mm) : null,
    wcToWrDistanceMm: row.wc_to_wr_distance_mm != null ? Number(row.wc_to_wr_distance_mm) : null,
    weldDiaMm: row.weld_dia_mm != null ? Number(row.weld_dia_mm) : null,
    argonUsed: row.argon_used,
    firstOffResult: row.first_off_result,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    is4mChange: row.is_4m_change,
    m4Category: row.m4_category,
    weldFlowOk: row.weld_flow_ok,
    ectCalibrated: row.ect_calibrated,
    coolantConcPct: row.coolant_conc_pct != null ? Number(row.coolant_conc_pct) : null,
    firstOffDims: row.first_off_dims,
    firstOffForm: row.first_off_form,
    weldFlowSurfaceVangle: row.weld_flow_surface_vangle,
    finPassDims: row.fin_pass_dims,
    slitThkMm: row.slit_thk_mm != null ? Number(row.slit_thk_mm) : null,
    slitWidthMm: row.slit_width_mm != null ? Number(row.slit_width_mm) : null,
    rollSet: row.roll_set,
    coolantPressureKg: row.coolant_pressure_kg != null ? Number(row.coolant_pressure_kg) : null,
    wiperUsed: row.wiper_used,
    speedMpmObs: row.speed_mpm_obs != null ? Number(row.speed_mpm_obs) : null,
    powerKwObs: row.power_kw_obs != null ? Number(row.power_kw_obs) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    band: null,
    tooling: {
      idTool: row.id_tool,
      odTool: row.od_tool,
      boggieSize: row.boggie_size,
      impederSize: row.impeder_size,
      ferriteRod: row.ferrite_rod,
      ssRod: row.ss_rod,
      workCoilId: row.work_coil_id,
      seamGuide: row.seam_guide,
      weldDiaMm: row.weld_dia_mm != null ? Number(row.weld_dia_mm) : null
    }
  };
}

export async function listMillSetups(millCode = 'A-59', limit = 50) {
  const rows = await query(
    `SELECT * FROM txn.tm_mill_setup
     WHERE tenant_id = $1 AND mill_code = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [config.tenantId, millCode, limit]
  );
  return rows.map(mapSetupRow);
}

export async function getMillSetup(id) {
  const row = await queryOne(
    `SELECT * FROM txn.tm_mill_setup WHERE id = $1 AND tenant_id = $2`,
    [id, config.tenantId]
  );
  return mapSetupRow(row);
}

/**
 * TM-02 chart prefill by size/grade/thk — independent of work order / run.
 */
export async function chartPrefill(sizeKey, thkMm, gradeCode) {
  const defaults = await resolveRunDefaults(sizeKey, Number(thkMm), gradeCode);
  if (!defaults) return null;
  return {
    sizeKey,
    thkMm: Number(thkMm),
    gradeCode,
    tooling: defaults.tooling,
    band: defaults.band
  };
}

export async function createMillSetup(data, createdBy = 'operator') {
  const millCode = data.millCode ?? 'A-59';
  let tooling = {
    idTool: data.idTool,
    odTool: data.odTool,
    boggieSize: data.boggieSize,
    impederSize: data.impederSize,
    ferriteRod: data.ferriteRod,
    ssRod: data.ssRod,
    workCoilId: data.workCoilId,
    seamGuide: data.seamGuide,
    weldDiaMm: data.weldDiaMm
  };

  if (data.sizeKey && data.thkMm != null && data.gradeCode) {
    const chart = await resolveRunDefaults(data.sizeKey, Number(data.thkMm), data.gradeCode);
    if (chart?.tooling) {
      tooling = {
        idTool: data.idTool ?? chart.tooling.idTool,
        odTool: data.odTool ?? chart.tooling.odTool,
        boggieSize: data.boggieSize ?? chart.tooling.boggieSize,
        impederSize: data.impederSize ?? chart.tooling.impederSize,
        ferriteRod: data.ferriteRod ?? chart.tooling.ferriteRod,
        ssRod: data.ssRod ?? chart.tooling.ssRod,
        workCoilId: data.workCoilId ?? chart.tooling.workCoilId,
        seamGuide: data.seamGuide ?? chart.tooling.seamGuide,
        weldDiaMm: data.weldDiaMm ?? chart.tooling.weldDiaMm
      };
    }
  }

  const row = await queryOne(
    `INSERT INTO txn.tm_mill_setup (
      tenant_id, mill_code, setup_type, reason, size_key, grade_code, thk_mm, note,
      id_tool, od_tool, boggie_size, impeder_size, ferrite_rod, ss_rod, work_coil_id, seam_guide,
      v_length_mm, v_gap_mm, wc_to_wr_distance_mm, weld_dia_mm, argon_used,
      is_4m_change, m4_category, weld_flow_ok, ect_calibrated, coolant_conc_pct,
      first_off_dims, first_off_form, weld_flow_surface_vangle, fin_pass_dims,
      slit_thk_mm, slit_width_mm, roll_set, coolant_pressure_kg, wiper_used,
      speed_mpm_obs, power_kw_obs, first_off_result, created_by
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,$13,$14,$15,$16,
      $17,$18,$19,$20,$21,
      $22,$23,$24,$25,$26,
      $27,$28,$29,$30,
      $31,$32,$33,$34,$35,
      $36,$37,$38,$39
    ) RETURNING *`,
    [
      config.tenantId,
      millCode,
      data.setupType ?? 'INITIAL',
      data.reason ?? null,
      data.sizeKey ?? null,
      data.gradeCode ?? null,
      data.thkMm ?? null,
      data.note ?? null,
      tooling.idTool ?? null,
      tooling.odTool ?? null,
      tooling.boggieSize ?? null,
      tooling.impederSize ?? null,
      tooling.ferriteRod ?? null,
      tooling.ssRod ?? null,
      tooling.workCoilId ?? null,
      tooling.seamGuide ?? null,
      data.vLengthMm ?? null,
      data.vGapMm ?? null,
      data.wcToWrDistanceMm ?? null,
      tooling.weldDiaMm ?? null,
      data.argonUsed ?? null,
      data.is4mChange ?? false,
      data.m4Category ?? null,
      data.weldFlowOk ?? null,
      data.ectCalibrated ?? null,
      data.coolantConcPct ?? null,
      data.firstOffDims != null ? JSON.stringify(data.firstOffDims) : null,
      data.firstOffForm != null ? JSON.stringify(data.firstOffForm) : null,
      data.weldFlowSurfaceVangle ?? null,
      data.finPassDims != null ? JSON.stringify(data.finPassDims) : null,
      data.slitThkMm ?? null,
      data.slitWidthMm ?? null,
      data.rollSet ?? null,
      data.coolantPressureKg ?? null,
      data.wiperUsed ?? null,
      data.speedMpmObs ?? null,
      data.powerKwObs ?? null,
      data.firstOffResult ?? null,
      createdBy
    ]
  );

  const mapped = mapSetupRow(row);
  if (data.sizeKey && data.thkMm != null && data.gradeCode) {
    const defaults = await resolveRunDefaults(data.sizeKey, Number(data.thkMm), data.gradeCode);
    if (mapped && defaults?.band) mapped.band = defaults.band;
  }
  return mapped;
}
