import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { getCachedMillLive, ensureMillLiveStamp } from './CollectorIngestService.js';
import { getRun } from './RunService.js';
import { listMillSetups } from './MillSetupService.js';

function hourFloor(d) {
  const h = new Date(d);
  h.setMinutes(0, 0, 0);
  return h;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentShiftRef() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

function parseSize(size) {
  if (!size) return null;
  if (typeof size === 'string') {
    try {
      return JSON.parse(size);
    } catch {
      return null;
    }
  }
  return size;
}

/**
 * Contextual auto-population source for the Parameter Console.
 * Reads the active RUNNING/STOPPAGE order for the mill — does NOT
 * attach parameter records to the run (no run_id ownership).
 */
export async function getParameterContext(millCode = 'A-59') {
  const row = await queryOne(
    `SELECT id FROM txn.prod_tm_run
     WHERE tenant_id = $1 AND mill_code = $2 AND status = 'DRAFT'
       AND run_state IN ('RUNNING', 'STOPPAGE')
     ORDER BY time_from DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [config.tenantId, millCode]
  );

  if (!row) {
    return {
      millCode,
      active: false,
      order: null,
      fromOrder: {
        odMm: null,
        thkMm: null,
        gradeCode: null,
        lengthMm: null
      },
      fromSetup: {
        idTool: null,
        odTool: null,
        workCoilId: null,
        impederSize: null,
        boggieSize: null,
        weldDiaMm: null,
        wcToWrDistanceMm: null,
        argonUsed: null
      }
    };
  }

  const run = await getRun(row.id);
  const size = parseSize(run?.size);
  const millSetups = await listMillSetups(millCode, 1);
  const latestSetup = millSetups[0] ?? null;

  const tooling = run?.tooling ?? null;

  return {
    millCode,
    active: true,
    order: {
      workOrderNo: run.workOrderNo ?? null,
      customerCode: run.customerCode ?? null,
      gradeCode: run.gradeCode ?? null,
      sizeKey: run.sizeKey ?? null,
      runState: run.runState ?? null,
      runNo: run.runNo ?? null
    },
    fromOrder: {
      odMm: size?.odMm ?? size?.equivOdMm ?? null,
      thkMm: size?.thkMm ?? null,
      gradeCode: run.gradeCode ?? null,
      lengthMm: size?.lengthMm ?? null
    },
    fromSetup: {
      idTool: tooling?.idTool ?? latestSetup?.idTool ?? null,
      odTool: tooling?.odTool ?? latestSetup?.odTool ?? null,
      workCoilId: tooling?.workCoilId ?? latestSetup?.workCoilId ?? null,
      impederSize: tooling?.impederSize ?? latestSetup?.impederSize ?? null,
      boggieSize: tooling?.boggieSize ?? latestSetup?.boggieSize ?? null,
      weldDiaMm: tooling?.weldDiaMm ?? latestSetup?.weldDiaMm ?? null,
      wcToWrDistanceMm: latestSetup?.wcToWrDistanceMm ?? null,
      argonUsed: latestSetup?.argonUsed ?? null
    }
  };
}

export async function listParamReadings(millCode = 'A-59', limit = 100) {
  return query(
    `SELECT * FROM txn.tm_param_reading
     WHERE tenant_id = $1 AND mill_code = $2
     ORDER BY ts_hour DESC
     LIMIT $3`,
    [config.tenantId, millCode, limit]
  );
}

export async function getMillLiveParams(millCode = 'A-59') {
  await ensureMillLiveStamp(millCode);
  const live = getCachedMillLive(millCode);
  return {
    millCode,
    speedMpm: live?.speedMpm ?? 0,
    powerKw: live?.powerKw ?? 0,
    currentAmp: live?.currentAmp ?? 0,
    inBand: live?.inBand ?? true,
    lineRunning: live?.lineRunning ?? false,
    at: live?.at ?? null
  };
}

/**
 * Upsert AUTO fields for the current hour (collector / live stamp).
 */
export async function upsertAutoReading(
  millCode,
  { speedMpm, powerKw, currentAmp, inBand }
) {
  const tsHour = hourFloor(new Date()).toISOString();
  await query(
    `INSERT INTO txn.tm_param_reading (
      tenant_id, mill_code, prod_date, shift_ref, ts_hour,
      line_speed_mpm, weld_power_kw, weld_current_amp, in_band, source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'AUTO')
    ON CONFLICT (tenant_id, mill_code, ts_hour) DO UPDATE SET
      line_speed_mpm = EXCLUDED.line_speed_mpm,
      weld_power_kw = EXCLUDED.weld_power_kw,
      weld_current_amp = EXCLUDED.weld_current_amp,
      in_band = EXCLUDED.in_band,
      source = CASE
        WHEN txn.tm_param_reading.coolant_oil_pct IS NOT NULL
          OR txn.tm_param_reading.coolant_pressure_kg IS NOT NULL
          OR txn.tm_param_reading.wiper_change IS NOT NULL
          OR txn.tm_param_reading.remarks IS NOT NULL
          OR txn.tm_param_reading.sign_ref IS NOT NULL
          OR txn.tm_param_reading.argon_used IS NOT NULL
          OR txn.tm_param_reading.wc_to_wr_distance_mm IS NOT NULL
        THEN 'MIXED'
        ELSE 'AUTO'
      END`,
    [
      config.tenantId,
      millCode,
      todayDate(),
      currentShiftRef(),
      tsHour,
      speedMpm ?? null,
      powerKw ?? null,
      currentAmp ?? null,
      inBand ?? null
    ]
  );
  return queryOne(
    `SELECT * FROM txn.tm_param_reading
     WHERE tenant_id = $1 AND mill_code = $2 AND ts_hour = $3`,
    [config.tenantId, millCode, tsHour]
  );
}

/**
 * Save MANUAL fields for current hour.
 * Speed / power are operator-entered until PLC integration; do not invent
 * collector zeros over explicit manual values. No run_id is stored.
 */
export async function saveMillParamManual(millCode, data, createdBy = 'operator') {
  const tsHour = hourFloor(new Date()).toISOString();

  const speed = data.speedMpm ?? null;
  const power = data.powerKw ?? null;
  const hasMachineManual = speed != null || power != null;

  await query(
    `INSERT INTO txn.tm_param_reading (
      tenant_id, mill_code, prod_date, shift_ref, ts_hour,
      line_speed_mpm, weld_power_kw, weld_current_amp, in_band,
      coolant_oil_pct, coolant_pressure_kg, wiper_change, argon_used,
      wc_to_wr_distance_mm, remarks, sign_ref,
      source, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT (tenant_id, mill_code, ts_hour) DO UPDATE SET
      line_speed_mpm = COALESCE(EXCLUDED.line_speed_mpm, txn.tm_param_reading.line_speed_mpm),
      weld_power_kw = COALESCE(EXCLUDED.weld_power_kw, txn.tm_param_reading.weld_power_kw),
      weld_current_amp = COALESCE(EXCLUDED.weld_current_amp, txn.tm_param_reading.weld_current_amp),
      in_band = COALESCE(EXCLUDED.in_band, txn.tm_param_reading.in_band),
      coolant_oil_pct = COALESCE(EXCLUDED.coolant_oil_pct, txn.tm_param_reading.coolant_oil_pct),
      coolant_pressure_kg = COALESCE(EXCLUDED.coolant_pressure_kg, txn.tm_param_reading.coolant_pressure_kg),
      wiper_change = COALESCE(EXCLUDED.wiper_change, txn.tm_param_reading.wiper_change),
      argon_used = COALESCE(EXCLUDED.argon_used, txn.tm_param_reading.argon_used),
      wc_to_wr_distance_mm = COALESCE(EXCLUDED.wc_to_wr_distance_mm, txn.tm_param_reading.wc_to_wr_distance_mm),
      remarks = COALESCE(EXCLUDED.remarks, txn.tm_param_reading.remarks),
      sign_ref = COALESCE(EXCLUDED.sign_ref, txn.tm_param_reading.sign_ref),
      source = 'MANUAL',
      created_by = COALESCE(EXCLUDED.created_by, txn.tm_param_reading.created_by)`,
    [
      config.tenantId,
      millCode,
      data.prodDate ?? todayDate(),
      data.shiftRef ?? currentShiftRef(),
      tsHour,
      speed,
      power,
      null,
      null,
      data.coolantOilPct ?? null,
      data.coolantPressureKg ?? null,
      data.wiperChange ?? null,
      data.argonUsed ?? null,
      data.wcToWrDistanceMm ?? null,
      data.remarks ?? null,
      data.signRef ?? null,
      hasMachineManual ? 'MANUAL' : 'MANUAL',
      createdBy
    ]
  );

  return queryOne(
    `SELECT * FROM txn.tm_param_reading
     WHERE tenant_id = $1 AND mill_code = $2 AND ts_hour = $3`,
    [config.tenantId, millCode, tsHour]
  );
}
