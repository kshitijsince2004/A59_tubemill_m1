import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { getBcConnector } from './ErpSyncService';

import { getRun, getCoils, getBundles, getStoppages } from '../services/RunService';
import { getAnnRun } from '../services/FurnaceService';
import { getStpLot } from '../services/StpService';
import { getDrwLot } from '../services/DrawBenchService';

async function insertJob(payload) {
  const row = await queryOne(
    `INSERT INTO erp.writeback_job (
       tenant_id, entry_id, api, process_code, source_id, payload, status
     ) VALUES ($1,$2,$3,$4,$5::uuid,$6,'STAGED')
     ON CONFLICT (tenant_id, entry_id) DO NOTHING
     RETURNING id`,
    [
    config.tenantId,
    payload.entryId,
    payload.kind,
    payload.processCode,
    payload.sourceId,
    JSON.stringify(payload)]

  );
  return Boolean(row);
}

function entryId(processCode, sourceId, kind, version = 1) {
  return `${processCode}:${sourceId}:${kind}:${version}`;
}

/** Stage Output / Consumption / Scrap jobs for a TM run on APPROVED. */
export async function enqueueTmWriteback(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  const [coils, bundles, stoppages] = await Promise.all([
  getCoils(runId),
  getBundles(runId),
  getStoppages(runId)]
  );

  let staged = 0;
  const base = {
    workOrderNo: run.workOrderNo,
    lotNo: coils[0]?.coil_id ?? run.bcBatchNumber
  };

  if (
  await insertJob({
    entryId: entryId('TM', runId, 'Output'),
    kind: 'Output',
    processCode: 'TM',
    sourceId: runId,
    ...base,
    qty: run.totalPrimeMt,
    uom: 'MT',
    runTimeS: run.netRuntimeS,
    extras: {
      runNo: run.runNo,
      scrapMt: run.totalScrapMt,
      yieldPct: run.yieldPct,
      bundleCount: bundles.length,
      stoppageCount: stoppages.length
    }
  }))
  {
    staged += 1;
  }

  if (
  await insertJob({
    entryId: entryId('TM', runId, 'Consumption'),
    kind: 'Consumption',
    processCode: 'TM',
    sourceId: runId,
    ...base,
    qty: run.rawMaterialMt,
    uom: 'MT',
    extras: { coilCount: coils.length, coils }
  }))
  {
    staged += 1;
  }

  if (run.totalScrapMt > 0) {
    if (
    await insertJob({
      entryId: entryId('TM', runId, 'Scrap'),
      kind: 'Scrap',
      processCode: 'TM',
      sourceId: runId,
      ...base,
      qty: run.totalScrapMt,
      uom: 'MT',
      scrapCode: 'SCR-DIM'
    }))
    {
      staged += 1;
    }
  }

  return { staged };
}

export async function enqueueFurWriteback(id) {
  const lot = await getAnnRun(id);
  if (!lot) throw new Error('Furnace charge not found');
  let staged = 0;
  if (
  await insertJob({
    entryId: entryId('FUR', id, 'Output'),
    kind: 'Output',
    processCode: 'FUR',
    sourceId: id,
    workOrderNo: lot.workOrderNo,
    qty: lot.totalMt ?? null,
    uom: 'MT',
    extras: {
      chargeNo: lot.chargeNo,
      totalNos: lot.totalNos,
      furnaceCode: lot.furnaceCode,
      pngConsumption: lot.pngConsumption,
      nh3Consumption: lot.nh3Consumption
    }
  }))
  {
    staged += 1;
  }
  return { staged };
}

export async function enqueueStpWriteback(id) {
  const lot = await getStpLot(id);
  if (!lot) throw new Error('STP lot not found');
  let staged = 0;
  if (
  await insertJob({
    entryId: entryId('STP', id, 'Output'),
    kind: 'Output',
    processCode: 'STP',
    sourceId: id,
    workOrderNo: lot.workOrderNo,
    lotNo: lot.lotNo,
    qty: lot.qtyMt ?? null,
    uom: 'MT',
    extras: { qtyNo: lot.qtyNo, machineCode: lot.machineCode }
  }))
  {
    staged += 1;
  }
  return { staged };
}

export async function enqueueDrwWriteback(id) {
  const lot = await getDrwLot(id);
  if (!lot) throw new Error('Draw Bench lot not found');
  let staged = 0;
  if (
  await insertJob({
    entryId: entryId('DRW', id, 'Output'),
    kind: 'Output',
    processCode: 'DRW',
    sourceId: id,
    workOrderNo: lot.workOrderNo,
    lotNo: lot.lotNo,
    qty: lot.acceptedPcs ?? null,
    uom: 'PCS',
    extras: {
      rejectedPcs: lot.rejectedPcs,
      drawnMetre: lot.drawnMetre,
      benchCode: lot.benchCode
    }
  }))
  {
    staged += 1;
  }
  if (lot.rejectedPcs && Number(lot.rejectedPcs) > 0) {
    if (
    await insertJob({
      entryId: entryId('DRW', id, 'Scrap'),
      kind: 'Scrap',
      processCode: 'DRW',
      sourceId: id,
      workOrderNo: lot.workOrderNo,
      lotNo: lot.lotNo,
      qty: Number(lot.rejectedPcs),
      uom: 'PCS',
      scrapCode: 'SCR-SURF'
    }))
    {
      staged += 1;
    }
  }
  return { staged };
}

/** Demo flush: STAGED → File connector post → LOGGED. */
export async function flushWriteback(limit = 50) {
  const jobs = await query(




    `SELECT id, api, payload FROM erp.writeback_job
     WHERE tenant_id = $1 AND status = 'STAGED'
     ORDER BY created_at ASC LIMIT $2`,
    [config.tenantId, limit]
  );

  const connector = getBcConnector();
  let flushed = 0;
  let failed = 0;

  for (const job of jobs) {
    const payload =
    typeof job.payload === 'string' ?
    JSON.parse(job.payload) :
    job.payload;
    try {
      const result = await connector.postJournal(payload.kind ?? job.api, payload);
      await query(
        `UPDATE erp.writeback_job
         SET status = 'LOGGED', bc_response = $2, attempts = attempts + 1, updated_at = now(), last_error = NULL
         WHERE id = $1`,
        [job.id, JSON.stringify(result.response)]
      );
      flushed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await query(
        `UPDATE erp.writeback_job
         SET status = 'FAILED', attempts = attempts + 1, last_error = $2, updated_at = now()
         WHERE id = $1`,
        [job.id, message]
      );
      failed += 1;
    }
  }

  return { flushed, failed };
}