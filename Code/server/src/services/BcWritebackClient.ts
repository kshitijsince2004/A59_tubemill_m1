import fs from 'fs';
import path from 'path';
import { query } from '../db/pool';
import { config, assertBcAdapterSupported } from '../config';
import { getRun, getCoils, getBundles, getStoppages } from './RunService';
import { buildDprExport } from './DprExportService';
import bundledQueuePlan from '../../seeds/queue_plan.json';

export interface QueueCardInput {
  id: string;
  millCode: string;
  status?: string;
  workOrderNo: string;
  bcBatchNumber: string;
  customerCode: string;
  gradeCode: string;
  sizeKey: string;
  size: Record<string, unknown>;
  qtyPieces?: number;
}

export interface BcPlanAdapter {
  pullWorkOrders(millCode: string): Promise<QueueCardInput[]>;
}

export interface BcWritebackAdapter {
  writeActuals(runId: string): Promise<{ ok: boolean; payload: unknown }>;
}

function loadQueuePlan(): QueueCardInput[] {
  if (config.bcPlanPath) {
    return JSON.parse(fs.readFileSync(path.resolve(config.bcPlanPath), 'utf8')) as QueueCardInput[];
  }
  // Bundled JSON — works when esbuild-bundled for Netlify (no __dirname filesystem reads).
  return bundledQueuePlan as QueueCardInput[];
}

/** File-based BC plan adapter — replace with live Dynamics OData when available. */
export class FileBcPlanAdapter implements BcPlanAdapter {
  async pullWorkOrders(millCode: string): Promise<QueueCardInput[]> {
    const raw = loadQueuePlan();
    return raw.filter((c) => c.millCode === millCode);
  }
}

export class FileBcWritebackAdapter implements BcWritebackAdapter {
  async writeActuals(runId: string): Promise<{ ok: boolean; payload: unknown }> {
    const run = await getRun(runId);
    if (!run) throw new Error('Run not found');
    if (!['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run.status)) {
      throw new Error('Run must be submitted before write-back');
    }

    const [coils, bundles, stoppages, dpr] = await Promise.all([
      getCoils(runId),
      getBundles(runId),
      getStoppages(runId),
      buildDprExport(runId),
    ]);

    const payload = {
      source: 'FileBcWritebackAdapter',
      runId,
      runNo: run.runNo,
      workOrderNo: run.workOrderNo,
      bcBatchNumber: run.bcBatchNumber,
      totals: {
        rawMaterialMt: run.rawMaterialMt,
        primeMt: run.totalPrimeMt,
        scrapMt: run.totalScrapMt,
        yieldPct: run.yieldPct,
      },
      coilCount: coils.length,
      bundleCount: bundles.length,
      stoppageCount: stoppages.length,
      dprSummary: dpr.qualityTotals,
      writtenAt: new Date().toISOString(),
    };

    await query(
      `INSERT INTO ops.bc_writeback_log (tenant_id, run_id, payload, status) VALUES ($1,$2,$3,'LOGGED')`,
      [config.tenantId, runId, JSON.stringify(payload)],
    );

    return { ok: true, payload };
  }
}

function getPlanAdapter(): BcPlanAdapter {
  assertBcAdapterSupported();
  return new FileBcPlanAdapter();
}

function getWritebackAdapter(): BcWritebackAdapter {
  assertBcAdapterSupported();
  return new FileBcWritebackAdapter();
}

export async function pullWorkOrders(millCode: string): Promise<QueueCardInput[]> {
  return getPlanAdapter().pullWorkOrders(millCode);
}

export async function syncPlanToQueue(millCode: string): Promise<{ upserted: number }> {
  const cards = await pullWorkOrders(millCode);
  let upserted = 0;
  for (const card of cards) {
    await query(
      `INSERT INTO ops.queue_card (
        id, tenant_id, mill_code, status, work_order_no, bc_batch_number,
        customer_code, grade_code, size_key, size, qty_pieces
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        work_order_no = EXCLUDED.work_order_no,
        bc_batch_number = EXCLUDED.bc_batch_number,
        customer_code = EXCLUDED.customer_code,
        grade_code = EXCLUDED.grade_code,
        size_key = EXCLUDED.size_key,
        size = EXCLUDED.size,
        qty_pieces = EXCLUDED.qty_pieces
      WHERE ops.queue_card.status = 'Pending'`,
      [
        card.id,
        config.tenantId,
        card.millCode,
        card.status ?? 'Pending',
        card.workOrderNo,
        card.bcBatchNumber,
        card.customerCode,
        card.gradeCode,
        card.sizeKey,
        JSON.stringify(card.size),
        card.qtyPieces ?? null,
      ],
    );
    upserted += 1;
  }
  return { upserted };
}

export async function writeActuals(runId: string): Promise<{ ok: boolean; payload: unknown }> {
  return getWritebackAdapter().writeActuals(runId);
}
