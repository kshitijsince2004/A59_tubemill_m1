import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { transition } from './StateMachine';
import { getRun, updateRunState } from './RunService';


import { publishMachineState } from '../events/DomainEvents';

const TOOLING_FIELDS = [
{ formKey: 'idTool', col: 'id_tool', chartKey: 'idTool' },
{ formKey: 'odTool', col: 'od_tool', chartKey: 'odTool' },
{ formKey: 'boggieSize', col: 'boggie_size', chartKey: 'boggieSize' },
{ formKey: 'impederSize', col: 'impeder_size', chartKey: 'impederSize' },
{ formKey: 'ferriteRod', col: 'ferrite_rod', chartKey: 'ferriteRod' },
{ formKey: 'ssRod', col: 'ss_rod', chartKey: 'ssRod' },
{ formKey: 'workCoilId', col: 'work_coil_id', chartKey: 'workCoilId' }];


export async function saveSetup(runId, setup, overriddenBy = 'operator') {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.runState !== 'SETUP') throw new Error('Run is not in SETUP state');

  const setupRow = await queryOne(
    `SELECT * FROM txn.tm_setup WHERE run_id = $1`,
    [runId]
  );

  if (setupRow && run.tooling) {
    for (const f of TOOLING_FIELDS) {
      const chartVal = run.tooling[f.chartKey];
      const opVal = setup[f.formKey];
      if (opVal != null && chartVal != null && String(opVal) !== String(chartVal)) {
        await query(
          `INSERT INTO txn.tm_setup_override_log (
            tenant_id, run_id, setup_id, field_name, chart_value, operator_value, overridden_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
          config.tenantId,
          runId,
          setupRow.id,
          f.formKey,
          String(chartVal),
          String(opVal),
          overriddenBy]

        );
      }
    }
  }

  await query(
    `UPDATE txn.tm_setup SET
      setup_type = $2,
      reason = $3,
      id_tool = $4,
      od_tool = $5,
      boggie_size = $6,
      impeder_size = $7,
      ferrite_rod = $8,
      ss_rod = $9,
      work_coil_id = $10,
      v_length_mm = $11,
      v_gap_mm = $12,
      wc_to_wr_distance_mm = $13,
      weld_dia_mm = $14,
      argon_used = $15,
      is_4m_change = $16,
      m4_category = $17,
      weld_flow_ok = $18,
      ect_calibrated = $19,
      coolant_conc_pct = $20,
      first_off_dims = COALESCE($21, first_off_dims),
      first_off_form = COALESCE($22, first_off_form),
      weld_flow_surface_vangle = $23,
      fin_pass_dims = COALESCE($24, fin_pass_dims),
      slit_thk_mm = $25,
      slit_width_mm = $26,
      roll_set = $27,
      coolant_pressure_kg = $28,
      wiper_used = $29,
      speed_mpm_obs = $30,
      power_kw_obs = $31
     WHERE run_id = $1`,
    [
    runId,
    setup.setupType,
    setup.reason ?? null,
    setup.idTool ?? null,
    setup.odTool ?? null,
    setup.boggieSize ?? null,
    setup.impederSize ?? null,
    setup.ferriteRod ?? null,
    setup.ssRod ?? null,
    setup.workCoilId ?? null,
    setup.vLengthMm ?? null,
    setup.vGapMm ?? null,
    setup.wcToWrDistanceMm ?? null,
    setup.weldDiaMm ?? null,
    setup.argonUsed ?? null,
    setup.is4mChange ?? false,
    setup.m4Category ?? null,
    setup.weldFlowOk ?? null,
    setup.ectCalibrated ?? null,
    setup.coolantConcPct ?? null,
    setup.firstOffDims != null ? JSON.stringify(setup.firstOffDims) : null,
    setup.firstOffForm != null ? JSON.stringify(setup.firstOffForm) : null,
    setup.weldFlowSurfaceVangle ?? null,
    setup.finPassDims != null ? JSON.stringify(setup.finPassDims) : null,
    setup.slitThkMm ?? null,
    setup.slitWidthMm ?? null,
    setup.rollSet ?? null,
    setup.coolantPressureKg ?? null,
    setup.wiperUsed ?? null,
    setup.speedMpmObs ?? null,
    setup.powerKwObs ?? null]

  );

  const nextState = transition(run.runState, 'TOOLING_CONFIRMED');
  await updateRunState(runId, nextState);
  await publishMachineState({
    millCode: run.millCode,
    runId,
    state: nextState,
    at: new Date().toISOString()
  });

  return getRun(runId);
}

export async function getSetup(runId) {
  return queryOne(`SELECT * FROM txn.tm_setup WHERE run_id = $1`, [runId]);
}
