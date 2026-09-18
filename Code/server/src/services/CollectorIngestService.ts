import {
  tmLineStartedSchema,
  tmLineStoppedSchema,
  tmPieceCutSchema,
  tmPowerSampleSchema,
} from '@a59/shared';
import type { MillRunState } from '@a59/shared';
import { getEventBus } from '../events/InProcessEventBus';
import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { checkInBand, bandViolationReason } from './ParamBandService';
import { theoreticalTubeWeightKg } from './ParamBandService';
import { transition, defaultQualityForAutoCount, canCountAsGood } from './StateMachine';
import { getRun, updateRunState, recalcRunRollups } from './RunService';
import { A59_SIGNAL_DEFS } from '../collector/tagMapping';
import { publishMachineState } from '../events/DomainEvents';

const lastLive = new Map<
  string,
  {
    speedMpm: number;
    powerKw: number;
    currentAmp: number;
    pieceCount: number;
    inBand: boolean;
    outOfBandSince: string | null;
    lineRunning: boolean;
  }
>();

async function claimIdempotency(scope: string, key: string): Promise<boolean> {
  try {
    await query(`INSERT INTO txn.idempotency_key (scope, key) VALUES ($1, $2)`, [scope, key]);
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateTag(millCode: string, signal: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM plc.tag WHERE tenant_id = $1 AND mill_code = $2 AND signal = $3`,
    [config.tenantId, millCode, signal],
  );
  if (row) return row.id;
  const def = A59_SIGNAL_DEFS.find((d) => d.signal === signal);
  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO plc.tag (tenant_id, mill_code, controller, signal, unit, driver)
     VALUES ($1,$2,$3,$4,$5,'SIM') RETURNING id`,
    [config.tenantId, millCode, def?.controller ?? 'LINE-PLC', signal, def?.unit ?? null],
  );
  return inserted?.id ?? null;
}

async function writeSample(millCode: string, signal: string, value: number, runId?: string, ts?: string) {
  const tagId = await getOrCreateTag(millCode, signal);
  if (!tagId) return;
  await query(
    `INSERT INTO plc.sample (tag_id, tenant_id, run_id, ts, value) VALUES ($1,$2,$3,$4,$5)`,
    [tagId, config.tenantId, runId ?? null, ts ?? new Date().toISOString(), value],
  );
}

function hourFloor(d: Date): Date {
  const h = new Date(d);
  h.setMinutes(0, 0, 0);
  return h;
}

async function upsertHourly(
  runId: string,
  speedMpm: number,
  powerKw: number,
  currentAmp: number,
  inBand: boolean,
) {
  const tsHour = hourFloor(new Date()).toISOString();
  await query(
    `INSERT INTO txn.prod_tm_param_snapshot (
      tenant_id, run_id, ts_hour, line_speed_mpm, weld_power_kw, weld_current_amp, in_band, source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'AUTO')
    ON CONFLICT (tenant_id, run_id, ts_hour) DO UPDATE SET
      line_speed_mpm = EXCLUDED.line_speed_mpm,
      weld_power_kw = EXCLUDED.weld_power_kw,
      weld_current_amp = EXCLUDED.weld_current_amp,
      in_band = EXCLUDED.in_band`,
    [config.tenantId, runId, tsHour, speedMpm, powerKw, currentAmp, inBand],
  );
}

async function openStoppage(runId: string, millCode: string) {
  const open = await queryOne(`SELECT id FROM txn.stoppage_entry WHERE run_id = $1 AND is_open = true`, [runId]);
  if (open) return;
  await query(
    `INSERT INTO txn.stoppage_entry (tenant_id, run_id, mill_code, from_time, is_open)
     VALUES ($1,$2,$3,now(),true)`,
    [config.tenantId, runId, millCode],
  );
}

async function closeStoppage(runId: string) {
  await query(
    `UPDATE txn.stoppage_entry SET
      to_time = now(),
      duration_min = EXTRACT(EPOCH FROM (now() - from_time)) / 60,
      is_open = false
     WHERE run_id = $1 AND is_open = true`,
    [runId],
  );
}

async function raiseOutOfBand(runId: string, millCode: string, powerKw: number, speedMpm: number, reason: string) {
  const open = await queryOne(
    `SELECT id FROM txn.tm_exception WHERE run_id = $1 AND kind = 'OUT_OF_BAND' AND is_open = true`,
    [runId],
  );
  if (open) return;
  await query(
    `INSERT INTO txn.tm_exception (tenant_id, run_id, mill_code, kind, power_kw, speed_mpm, detail)
     VALUES ($1,$2,$3,'OUT_OF_BAND',$4,$5,$6)`,
    [config.tenantId, runId, millCode, powerKw, speedMpm, JSON.stringify({ reason })],
  );
}

async function clearOutOfBand(runId: string) {
  await query(
    `UPDATE txn.tm_exception SET is_open = false, closed_at = now()
     WHERE run_id = $1 AND kind = 'OUT_OF_BAND' AND is_open = true`,
    [runId],
  );
}

async function bookPieces(runId: string, quantity: number, countId: string) {
  const claimed = await claimIdempotency('piece_cut', countId);
  if (!claimed) return;

  const run = await getRun(runId);
  if (!run) return;
  if (!['RUNNING', 'FIRST_OFF_PENDING', 'SETUP'].includes(run.runState)) return;
  if (run.holdStatus === 'HELD') return;

  let quality = defaultQualityForAutoCount(run.runState as MillRunState, run.firstOffStatus);
  const live = lastLive.get(runId);
  const needsReview = live ? !live.inBand : false;
  if (needsReview && quality === 'PRIME') {
    quality = 'SCRAP';
  }

  const existing = await queryOne<{ max_no: number }>(
    `SELECT COALESCE(MAX(bundle_no), 0)::int AS max_no FROM txn.prod_tm_bundle WHERE run_id = $1`,
    [runId],
  );
  const size = run.size as Parameters<typeof theoreticalTubeWeightKg>[0];
  const weightKg = theoreticalTubeWeightKg(size, quantity);

  await query(
    `INSERT INTO txn.prod_tm_bundle (
      tenant_id, run_id, bundle_no, pieces, weight_kg, weight_source, quality_class, length_mm, needs_review
    ) VALUES ($1,$2,$3,$4,$5,'DERIVED',$6,$7,$8)`,
    [
      config.tenantId,
      runId,
      (existing?.max_no ?? 0) + 1,
      quantity,
      weightKg,
      quality,
      size.lengthMm ?? 6000,
      needsReview,
    ],
  );
  await recalcRunRollups(runId);

  if (live) live.pieceCount += quantity;
}

export function getCachedLive(runId: string) {
  return lastLive.get(runId) ?? null;
}

export function registerCollectorConsumers(): void {
  const bus = getEventBus();

  bus.subscribe('tm.line_stopped', async (payload) => {
    const parsed = tmLineStoppedSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.runId) return;
    const run = await getRun(parsed.data.runId);
    if (!run || run.runState !== 'RUNNING') return;
    await updateRunState(parsed.data.runId, transition('RUNNING', 'LINE_STOPPED'));
    await openStoppage(parsed.data.runId, parsed.data.millCode);
    await publishMachineState({
      millCode: parsed.data.millCode,
      runId: parsed.data.runId,
      state: 'STOPPAGE',
      at: parsed.data.at,
    });
    const live = lastLive.get(parsed.data.runId);
    if (live) live.lineRunning = false;
  });

  bus.subscribe('tm.line_started', async (payload) => {
    const parsed = tmLineStartedSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.runId) return;
    const run = await getRun(parsed.data.runId);
    if (!run || run.runState !== 'STOPPAGE') return;
    await updateRunState(parsed.data.runId, transition('STOPPAGE', 'LINE_STARTED'));
    await closeStoppage(parsed.data.runId);
    await publishMachineState({
      millCode: parsed.data.millCode,
      runId: parsed.data.runId,
      state: 'RUNNING',
      at: parsed.data.at,
    });
    const live = lastLive.get(parsed.data.runId);
    if (live) live.lineRunning = true;
  });

  bus.subscribe('tm.piece_cut', async (payload) => {
    const parsed = tmPieceCutSchema.safeParse(payload);
    if (!parsed.success) return;
    await bookPieces(parsed.data.runId, parsed.data.quantity, parsed.data.countId);
  });

  bus.subscribe('tm.power_sample', async (payload) => {
    const parsed = tmPowerSampleSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.runId) return;
    const { runId, millCode, speedMpm = 0, powerKw = 0, currentAmp = 0, at } = parsed.data;
    const run = await getRun(runId);
    if (!run?.band) return;

    await writeSample(millCode, 'LINE_SPEED', speedMpm, runId, at);
    await writeSample(millCode, 'WELD_POWER', powerKw, runId, at);
    await writeSample(millCode, 'WELD_CURRENT', currentAmp, runId, at);

    const inBand = checkInBand(powerKw, run.band, speedMpm);
    if (!inBand) {
      await raiseOutOfBand(
        runId,
        millCode,
        powerKw,
        speedMpm,
        bandViolationReason(powerKw, speedMpm, run.band),
      );
    } else {
      await clearOutOfBand(runId);
    }

    const prev = lastLive.get(runId);
    lastLive.set(runId, {
      speedMpm,
      powerKw,
      currentAmp,
      pieceCount: prev?.pieceCount ?? 0,
      inBand,
      outOfBandSince: inBand ? null : prev?.outOfBandSince ?? at,
      lineRunning: prev?.lineRunning ?? true,
    });

    await upsertHourly(runId, speedMpm, powerKw, currentAmp, inBand);
  });
}

export async function ingestHttpEvent(event: string, payload: unknown): Promise<void> {
  await getEventBus().publish(event, payload);
}

export async function getLiveFromIngest(runId: string) {
  const run = await getRun(runId);
  if (!run) return null;
  const cached = lastLive.get(runId);
  const openEx = await queryOne(
    `SELECT opened_at FROM txn.tm_exception WHERE run_id = $1 AND is_open = true LIMIT 1`,
    [runId],
  );

  return {
    runId,
    millCode: run.millCode,
    runState: run.runState,
    firstOffStatus: run.firstOffStatus,
    speedMpm: Math.round((cached?.speedMpm ?? 0) * 10) / 10,
    powerKw: Math.round((cached?.powerKw ?? 0) * 10) / 10,
    currentAmp: Math.round(cached?.currentAmp ?? 0),
    pieceCount: cached?.pieceCount ?? 0,
    inBand: cached?.inBand ?? true,
    outOfBand: cached ? !cached.inBand : false,
    outOfBandSince: openEx ? String((openEx as { opened_at: string }).opened_at) : cached?.outOfBandSince,
    band: run.band,
    canCountAsGood: canCountAsGood(run.runState as MillRunState, run.firstOffStatus),
    lineRunning: cached?.lineRunning ?? true,
  };
}
