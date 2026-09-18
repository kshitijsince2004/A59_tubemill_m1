import { getEventBus } from '../events/InProcessEventBus';
import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { getRun } from '../services/RunService';
import { A59_SIGNAL_DEFS } from './tagMapping';
import { simDriver } from './SimPlcDriver';
import { UnsupportedPlcDriver } from './UnsupportedPlcDriver';
import type { PlcDriver } from './types';

const tagCache = new Map<string, string>();
const lastRunState = new Map<string, boolean>();
const lastCutCount = new Map<string, number>();
const eventBuffer: { event: string; payload: unknown }[] = [];
let interval: ReturnType<typeof setInterval> | null = null;
let dbHealthy = true;

async function ensureTags(millCode: string): Promise<void> {
  for (const def of A59_SIGNAL_DEFS) {
    const key = `${millCode}:${def.signal}`;
    if (tagCache.has(key)) continue;
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM plc.tag WHERE tenant_id = $1 AND mill_code = $2 AND signal = $3`,
      [config.tenantId, millCode, def.signal],
    );
    if (existing) {
      tagCache.set(key, existing.id);
      continue;
    }
    const row = await queryOne<{ id: string }>(
      `INSERT INTO plc.tag (tenant_id, mill_code, controller, signal, unit, driver)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [config.tenantId, millCode, def.controller, def.signal, def.unit, 'SIM'],
    );
    if (row) tagCache.set(key, row.id);
  }
}

async function publishOrBuffer(event: string, payload: unknown): Promise<void> {
  try {
    await getEventBus().publish(event, payload);
    dbHealthy = true;
  } catch {
    eventBuffer.push({ event, payload });
    dbHealthy = false;
  }
}

async function flushBuffer(): Promise<void> {
  while (eventBuffer.length > 0) {
    const item = eventBuffer[0];
    try {
      await getEventBus().publish(item.event, item.payload);
      eventBuffer.shift();
    } catch {
      break;
    }
  }
}

async function heartbeat(millCode: string): Promise<void> {
  await query(
    `INSERT INTO plc.collector_health (mill_code, last_sample_at, backlog, heartbeat_at)
     VALUES ($1, now(), $2, now())
     ON CONFLICT (mill_code) DO UPDATE SET
       last_sample_at = now(),
       backlog = EXCLUDED.backlog,
       heartbeat_at = now()`,
    [millCode, eventBuffer.length],
  );
}

function getDriver(): PlcDriver {
  if (config.collectorMode !== 'sim') {
    return new UnsupportedPlcDriver(config.collectorMode);
  }
  return simDriver;
}

export function startCollectorForRun(runId: string): void {
  const driver = getDriver();
  driver.start(runId);
  void (async () => {
    const run = await getRun(runId);
    if (run?.band && driver instanceof Object && 'setBand' in simDriver) {
      simDriver.setBand(runId, run.band);
    }
    await ensureTags(driver.millCode);
  })();
  startLoop();
}

export function stopCollectorForRun(runId: string): void {
  getDriver().stop(runId);
  lastRunState.delete(runId);
  lastCutCount.delete(runId);
}

export function setCollectorForceOutOfBand(runId: string, force: boolean): void {
  getDriver().setForceOutOfBand(runId, force);
}

export function getCollectorLive(runId: string) {
  return getDriver().getLiveSnapshot(runId);
}

function startLoop(): void {
  if (config.collectorOnDemand) return;
  if (interval) return;
  interval = setInterval(() => void tick(), 2000);
}

/** Drive one collector poll (used on Netlify where setInterval cannot survive between requests). */
export async function tickCollectorOnce(): Promise<void> {
  await tick();
}

async function tick(): Promise<void> {
  await flushBuffer();
  const driver = getDriver();
  const activeRuns = await query<{ id: string; mill_code: string; run_state: string; status: string }>(
    `SELECT id, mill_code, run_state, status FROM txn.prod_tm_run
     WHERE tenant_id = $1 AND status NOT IN ('LOCKED') AND run_state NOT IN ('RUN_COMPLETE','IDLE')`,
    [config.tenantId],
  );

  for (const run of activeRuns) {
    if (['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run.status) && run.run_state === 'RUN_COMPLETE') {
      stopCollectorForRun(run.id);
      continue;
    }
    driver.start(run.id);
    const runFull = await getRun(run.id);
    if (runFull?.band) simDriver.setBand(run.id, runFull.band);

    const readings = driver.poll(run.id);
    if (readings.length === 0) continue;

    const bySignal = Object.fromEntries(readings.map((r) => [r.signal, r]));
    const at = readings[0].at;
    const lineRunning = (bySignal.RUN_STATE?.value ?? 1) === 1;
    const prevRunning = lastRunState.get(run.id);

    if (prevRunning === true && !lineRunning) {
      await publishOrBuffer('tm.line_stopped', {
        millCode: run.mill_code,
        runId: run.id,
        at,
      });
    }
    if (prevRunning === false && lineRunning) {
      await publishOrBuffer('tm.line_started', {
        millCode: run.mill_code,
        runId: run.id,
        at,
      });
    }
    lastRunState.set(run.id, lineRunning);

    const cutCount = bySignal.CUT_COUNT?.value ?? 0;
    const prevCut = lastCutCount.get(run.id) ?? cutCount;
    if (cutCount > prevCut) {
      const delta = Math.floor(cutCount - prevCut);
      const countId = `${run.id}:${Math.floor(cutCount)}:${at}`;
      await publishOrBuffer('tm.piece_cut', {
        millCode: run.mill_code,
        runId: run.id,
        countId,
        quantity: delta,
        at,
      });
    }
    lastCutCount.set(run.id, cutCount);

    await publishOrBuffer('tm.power_sample', {
      millCode: run.mill_code,
      runId: run.id,
      speedMpm: bySignal.LINE_SPEED?.value,
      powerKw: bySignal.WELD_POWER?.value,
      currentAmp: bySignal.WELD_CURRENT?.value,
      at,
    });
  }

  await heartbeat(driver.millCode);
  if (!dbHealthy && eventBuffer.length === 0) dbHealthy = true;
}

export function startCollectorLoop(): void {
  if (config.collectorOnDemand) {
    console.log('[collector] on-demand mode — interval suppressed (drive via tickCollectorOnce)');
    return;
  }
  startLoop();
}
