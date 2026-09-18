import { getRun } from './RunService';
import { config } from '../config';

export interface YieldResult {
  runId: string;
  rawMaterialMt: number;
  acceptedMt: number;
  scrapMt: number;
  accountedMt: number;
  deltaMt: number;
  deltaPct: number | null;
  tolerancePct: number;
  status: 'ok' | 'warn';
  message: string;
}

export async function reconcileYield(runId: string): Promise<YieldResult> {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');

  const tolerancePct = config.yieldTolerancePct;
  const raw = run.rawMaterialMt;
  const accepted = run.totalPrimeMt + run.totalPq2Mt + run.totalCqMt + run.totalOpenMt;
  const scrap = run.totalScrapMt;
  const accounted = accepted + scrap;
  const delta = raw - accounted;
  const deltaPct = raw > 0 ? Math.round((Math.abs(delta) / raw) * 10000) / 100 : null;
  const status: 'ok' | 'warn' =
    raw > 0 && deltaPct != null && deltaPct > tolerancePct ? 'warn' : 'ok';

  return {
    runId,
    rawMaterialMt: raw,
    acceptedMt: accepted,
    scrapMt: scrap,
    accountedMt: accounted,
    deltaMt: Math.round(delta * 1000) / 1000,
    deltaPct,
    tolerancePct,
    status,
    message:
      status === 'warn'
        ? `Mass imbalance ${deltaPct}% exceeds tolerance ${tolerancePct}%`
        : 'Mass balance within tolerance',
  };
}
