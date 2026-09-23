import layout from '../export/layouts/drawbench_drw01.v1.json';
import { getDrwLot } from './DrawBenchService';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildDrawBenchExport(id) {
  const lot = await getDrwLot(id);
  if (!lot) throw new Error('Draw lot not found');
  return {
    layout,
    generatedAt: new Date().toISOString(),
    format: 'drw-01',
    lot,
  };
}

export async function buildDrawBenchCsv(id) {
  const { lot, layout: lay } = await buildDrawBenchExport(id);
  const fieldMap = {
    benchCode: lot.benchCode,
    operatorRef: lot.operatorRef ?? '',
    workOrderNo: lot.workOrderNo ?? '',
    gradeCode: lot.gradeCode ?? '',
    customerName: lot.customerName ?? '',
    customerCode: lot.customerCode ?? '',
    finalOdMm: lot.finalOdMm ?? '',
    finalIdMm: lot.finalIdMm ?? '',
    finalThMm: lot.finalThMm ?? '',
    finalLenMm: lot.finalLenMm ?? '',
    fromOdMm: lot.fromOdMm ?? '',
    fromThMm: lot.fromThMm ?? '',
    fromLenMm: lot.fromLenMm ?? '',
    toOdMm: lot.toOdMm ?? '',
    toIdMm: lot.toIdMm ?? '',
    toThMm: lot.toThMm ?? '',
    toLenMm: lot.toLenMm ?? '',
    drawPlanLenMm: lot.drawPlanLenMm ?? '',
    stage: lot.stage ?? lot.passType ?? '',
    acceptedPcs: lot.acceptedPcs ?? '',
    acceptedMt: lot.acceptedMt ?? '',
    rejectedPcs: lot.rejectedPcs ?? '',
    drawnMetre: lot.drawnMetre ?? '',
    remarks: lot.remarks ?? '',
    breakdownRemark: lot.breakdownRemark ?? '',
    supervisorRef: lot.supervisorRef ?? '',
    shiftInchargeRef: lot.shiftInchargeRef ?? '',
    shiftRef: lot.shiftRef ?? '',
    prodDate: lot.prodDate ?? '',
  };
  const cols = Array.isArray(lay?.columns) ? lay.columns : Object.keys(fieldMap);
  const rows = [['field', 'value'], ...cols.map((c) => [c, fieldMap[c] ?? ''])];
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}
