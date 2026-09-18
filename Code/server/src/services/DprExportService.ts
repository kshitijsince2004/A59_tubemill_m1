import { getRun, getCoils, getBundles, getStoppages } from './RunService';
import { query } from '../db/pool';
import { reconcileYield } from './YieldReconciliationService';
import { getSetup } from './SetupService';
import layout from '../export/layouts/tubemill_dpr.v1.json';

export async function buildDprExport(runId: string) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  const [coils, bundles, stoppages, snapshots, setup, yieldResult] = await Promise.all([
    getCoils(runId),
    getBundles(runId),
    getStoppages(runId),
    query(`SELECT * FROM txn.prod_tm_param_snapshot WHERE run_id = $1 ORDER BY ts_hour`, [runId]),
    getSetup(runId),
    reconcileYield(runId),
  ]);

  return {
    layout,
    generatedAt: new Date().toISOString(),
    format: 'dpr',
    run,
    tooling: run.tooling,
    band: run.band,
    setup,
    coils,
    bundles,
    stoppages,
    paramSnapshots: snapshots,
    qualityTotals: {
      primeMt: run.totalPrimeMt,
      pq2Mt: run.totalPq2Mt,
      cqMt: run.totalCqMt,
      openMt: run.totalOpenMt,
      scrapMt: run.totalScrapMt,
    },
    yield: yieldResult,
  };
}

export async function buildShiftSummary(runId: string) {
  const dpr = await buildDprExport(runId);
  return {
    format: 'shift-summary',
    generatedAt: dpr.generatedAt,
    millCode: dpr.run.millCode,
    runNo: dpr.run.runNo,
    workOrderNo: dpr.run.workOrderNo,
    runState: dpr.run.runState,
    status: dpr.run.status,
    totals: dpr.qualityTotals,
    yield: dpr.yield,
    stoppageCount: dpr.stoppages.length,
    coilCount: dpr.coils.length,
    bundleCount: dpr.bundles.length,
    grossRuntimeS: dpr.run.grossRuntimeS,
    netRuntimeS: dpr.run.netRuntimeS,
    netRuntimeHint: dpr.run.timeFrom,
  };
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Flat CSV from DPR layout fields + quality totals */
export async function buildDprCsv(runId: string): Promise<string> {
  const dpr = await buildDprExport(runId);
  const rows: (string | number)[][] = [
    ['field', 'value'],
    ['runNo', dpr.run.runNo],
    ['millCode', dpr.run.millCode],
    ['workOrderNo', dpr.run.workOrderNo ?? ''],
    ['gradeCode', dpr.run.gradeCode ?? ''],
    ['sizeKey', dpr.run.sizeKey],
    ['status', dpr.run.status],
    ['runState', dpr.run.runState],
    ['rawMaterialMt', dpr.run.rawMaterialMt],
    ['primeMt', dpr.qualityTotals.primeMt],
    ['pq2Mt', dpr.qualityTotals.pq2Mt],
    ['cqMt', dpr.qualityTotals.cqMt],
    ['openMt', dpr.qualityTotals.openMt],
    ['scrapMt', dpr.qualityTotals.scrapMt],
    ['yieldPct', dpr.run.yieldPct ?? ''],
    ['grossRuntimeS', dpr.run.grossRuntimeS ?? ''],
    ['netRuntimeS', dpr.run.netRuntimeS ?? ''],
    ['coilCount', dpr.coils.length],
    ['bundleCount', dpr.bundles.length],
    ['stoppageCount', dpr.stoppages.length],
    ['yieldStatus', dpr.yield.status],
    ['yieldMessage', dpr.yield.message],
  ];
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}
