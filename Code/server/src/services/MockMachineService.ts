import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { canCountAsGood } from './StateMachine';
import { getRun } from './RunService';
import {
  getLiveFromIngest,
  getCachedLive,
} from './CollectorIngestService';
import {
  startCollectorForRun,
  setCollectorForceOutOfBand,
} from '../collector/CollectorRunner';
import type { MillRunState } from '@a59/shared';

function hourFloor(d: Date): Date {
  const h = new Date(d);
  h.setMinutes(0, 0, 0);
  return h;
}

/** Live strip: collector + ingest own samples/counts; this only reads. */
export async function getLive(runId: string) {
  startCollectorForRun(runId);
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
    canCountAsGood: canCountAsGood(run.runState as MillRunState, run.firstOffStatus),
    lineRunning: cached?.lineRunning ?? true,
  };
}

export function setForceOutOfBand(runId: string, force: boolean) {
  setCollectorForceOutOfBand(runId, force);
}

export async function saveParamManual(
  runId: string,
  data: { coolantOilPct?: number; wiperChange?: boolean; coolantPressureKg?: number; remarks?: string },
) {
  const tsHour = hourFloor(new Date()).toISOString();
  await query(
    `INSERT INTO txn.prod_tm_param_snapshot (
      tenant_id, run_id, ts_hour, coolant_oil_pct, wiper_change, coolant_pressure_kg, remarks, source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'MANUAL')
    ON CONFLICT (tenant_id, run_id, ts_hour) DO UPDATE SET
      coolant_oil_pct = COALESCE(EXCLUDED.coolant_oil_pct, txn.prod_tm_param_snapshot.coolant_oil_pct),
      wiper_change = COALESCE(EXCLUDED.wiper_change, txn.prod_tm_param_snapshot.wiper_change),
      coolant_pressure_kg = COALESCE(EXCLUDED.coolant_pressure_kg, txn.prod_tm_param_snapshot.coolant_pressure_kg),
      remarks = COALESCE(EXCLUDED.remarks, txn.prod_tm_param_snapshot.remarks)`,
    [
      config.tenantId,
      runId,
      tsHour,
      data.coolantOilPct ?? null,
      data.wiperChange ?? null,
      data.coolantPressureKg ?? null,
      data.remarks ?? null,
    ],
  );

  return queryOne(`SELECT * FROM txn.prod_tm_param_snapshot WHERE run_id = $1 AND ts_hour = $2`, [runId, tsHour]);
}

export async function codeStoppage(stoppageId: string, stoppageCode: string, reason?: string, remark?: string) {
  const code = await queryOne<{ category: string; is_planned: boolean }>(
    `SELECT category, is_planned FROM master.stoppage_code WHERE code = $1`,
    [stoppageCode],
  );

  await query(
    `UPDATE txn.stoppage_entry SET
      stoppage_code = $2,
      category = $3,
      is_planned = $4,
      reason = $5,
      remark = $6
     WHERE id = $1`,
    [stoppageId, stoppageCode, code?.category ?? null, code?.is_planned ?? false, reason ?? null, remark ?? null],
  );

  return queryOne(`SELECT * FROM txn.stoppage_entry WHERE id = $1`, [stoppageId]);
}

export async function getExceptions(runId: string) {
  return query(
    `SELECT * FROM txn.tm_exception WHERE run_id = $1 ORDER BY opened_at DESC`,
    [runId],
  );
}
