import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { canCountAsGood } from './StateMachine';
import { getRun } from './RunService';
import {
  getLiveFromIngest,
  getCachedLive } from
'./CollectorIngestService';
import {
  startCollectorForRun,
  setCollectorForceOutOfBand,
  tickCollectorOnce } from
'../collector/CollectorRunner';


function hourFloor(d) {
  const h = new Date(d);
  h.setMinutes(0, 0, 0);
  return h;
}

/** Live strip: collector + ingest own samples/counts; this only reads. */
export async function getLive(runId) {
  startCollectorForRun(runId);
  // Serverless / on-demand: advance the sim on each live poll (UI already polls this endpoint).
  if (config.collectorOnDemand) {
    await tickCollectorOnce();
  }
  const live = await getLiveFromIngest(runId);
  if (live) return live;

  const run = await getRun(runId);
  if (!run) return null;
  const cached = getCachedLive(runId);
  return {
    runId,
    millCode: run.millCode,
    runState: run.runState,
    firstOffStatus: run.firstOffStatus,
    speedMpm: cached?.speedMpm ?? 0,
    powerKw: cached?.powerKw ?? 0,
    currentAmp: cached?.currentAmp ?? 0,
    pieceCount: cached?.pieceCount ?? 0,
    inBand: cached?.inBand ?? true,
    outOfBand: cached ? !cached.inBand : false,
    outOfBandSince: cached?.outOfBandSince ?? null,
    band: run.band,
    canCountAsGood: canCountAsGood(run.runState, run.firstOffStatus),
    lineRunning: cached?.lineRunning ?? true
  };
}

export function setForceOutOfBand(runId, force) {
  setCollectorForceOutOfBand(runId, force);
}

export async function saveParamManual(
runId,
data)
{
  // Deprecated run-tied path — prefer MillParamService.saveMillParamManual.
  // Kept for legacy DPR clients; no longer gates on first-off.
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  const tsHour = hourFloor(new Date()).toISOString();
  let speed = null;
  let power = null;
  let current = null;
  let inBand = null;
  try {
    const { getLiveFromIngest, getCachedLive, getCachedMillLive } = await import('./CollectorIngestService.js');
    const live = (await getLiveFromIngest(runId)) ?? getCachedLive(runId) ?? getCachedMillLive(run.millCode);
    if (live) {
      speed = live.speedMpm ?? null;
      power = live.powerKw ?? null;
      current = live.currentAmp ?? null;
      inBand = live.inBand ?? null;
    }
  } catch {
    /* optional live stamp */
  }

  await query(
    `INSERT INTO txn.prod_tm_param_snapshot (
      tenant_id, run_id, ts_hour, line_speed_mpm, weld_power_kw, weld_current_amp, in_band,
      coolant_oil_pct, wiper_change, coolant_pressure_kg, remarks, source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'MANUAL')
    ON CONFLICT (tenant_id, run_id, ts_hour) DO UPDATE SET
      line_speed_mpm = COALESCE(EXCLUDED.line_speed_mpm, txn.prod_tm_param_snapshot.line_speed_mpm),
      weld_power_kw = COALESCE(EXCLUDED.weld_power_kw, txn.prod_tm_param_snapshot.weld_power_kw),
      weld_current_amp = COALESCE(EXCLUDED.weld_current_amp, txn.prod_tm_param_snapshot.weld_current_amp),
      in_band = COALESCE(EXCLUDED.in_band, txn.prod_tm_param_snapshot.in_band),
      coolant_oil_pct = COALESCE(EXCLUDED.coolant_oil_pct, txn.prod_tm_param_snapshot.coolant_oil_pct),
      wiper_change = COALESCE(EXCLUDED.wiper_change, txn.prod_tm_param_snapshot.wiper_change),
      coolant_pressure_kg = COALESCE(EXCLUDED.coolant_pressure_kg, txn.prod_tm_param_snapshot.coolant_pressure_kg),
      remarks = COALESCE(EXCLUDED.remarks, txn.prod_tm_param_snapshot.remarks)`,
    [
    config.tenantId,
    runId,
    tsHour,
    speed,
    power,
    current,
    inBand,
    data.coolantOilPct ?? null,
    data.wiperChange ?? null,
    data.coolantPressureKg ?? null,
    data.remarks ?? null]

  );

  // Also write mill-scoped reading (canonical Parameters store)
  try {
    const { saveMillParamManual } = await import('./MillParamService.js');
    await saveMillParamManual(run.millCode ?? 'A-59', data);
  } catch {
    /* optional */
  }

  return queryOne(`SELECT * FROM txn.prod_tm_param_snapshot WHERE run_id = $1 AND ts_hour = $2`, [runId, tsHour]);
}

export async function listParamSnapshots(runId) {
  return query(
    `SELECT * FROM txn.prod_tm_param_snapshot WHERE run_id = $1 ORDER BY ts_hour`,
    [runId]
  );
}

export async function codeStoppage(stoppageId, stoppageCode, reason, remark) {
  const code = await queryOne(
    `SELECT category, is_planned FROM master.stoppage_code WHERE code = $1`,
    [stoppageCode]
  );

  await query(
    `UPDATE txn.stoppage_entry SET
      stoppage_code = $2,
      category = $3,
      is_planned = $4,
      reason = $5,
      remark = $6
     WHERE id = $1`,
    [stoppageId, stoppageCode, code?.category ?? null, code?.is_planned ?? false, reason ?? null, remark ?? null]
  );

  return queryOne(`SELECT * FROM txn.stoppage_entry WHERE id = $1`, [stoppageId]);
}

export async function getExceptions(runId) {
  return query(
    `SELECT * FROM txn.tm_exception WHERE run_id = $1 ORDER BY opened_at DESC`,
    [runId]
  );
}