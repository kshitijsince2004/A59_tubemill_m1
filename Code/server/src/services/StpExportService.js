import layout from '../export/layouts/stp_01a.v1.json';
import { getStpLot } from './StpService';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildStpExport(id) {
  const lot = await getStpLot(id);
  if (!lot) throw new Error('STP lot not found');
  return {
    layout,
    generatedAt: new Date().toISOString(),
    format: 'stp-01a',
    lot
  };
}

export async function buildStpCsv(id) {
  const { lot } = await buildStpExport(id);
  const rows = [
  ['field', 'value'],
  ['lotNo', lot.lotNo],
  ['workOrderNo', lot.workOrderNo ?? ''],
  ['customerCode', lot.customerCode ?? ''],
  ['gradeCode', lot.gradeCode ?? ''],
  ['qtyNo', lot.qtyNo ?? ''],
  ['qtyMt', lot.qtyMt ?? ''],
  ['degreaseTempC', lot.degreaseTempC ?? ''],
  ['degreaseTimeMin', lot.degreaseTimeMin ?? ''],
  ['pickleTimeMin', lot.pickleTimeMin ?? ''],
  ['phosphateTempC', lot.phosphateTempC ?? ''],
  ['phosphateTimeMin', lot.phosphateTimeMin ?? ''],
  ['lubeTempC', lot.lubeTempC ?? ''],
  ['lubeTimeMin', lot.lubeTimeMin ?? ''],
  ['surfaceFinish', lot.surfaceFinish ?? ''],
  ['status', lot.status],
  ['bathAnalysisCount', Array.isArray(lot.bathAnalyses) ? lot.bathAnalyses.length : 0]];

  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}