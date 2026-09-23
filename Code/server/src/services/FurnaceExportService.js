import layout from '../export/layouts/furnace_ann_ft01.v1.json';
import { getAnnRun } from './FurnaceService.js';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatSize(size) {
  if (!size) return '';
  const od = size.odMm ?? '';
  const thk = size.thkMm ?? '';
  const len = size.lengthMm ?? '';
  if (od === '' && thk === '' && len === '') return '';
  return `${od} × ${thk} × ${len}`;
}

export async function buildFurnaceExport(id) {
  const run = await getAnnRun(id);
  if (!run) throw new Error('Furnace production run not found');
  return {
    layout,
    generatedAt: new Date().toISOString(),
    format: 'ann-ft-01',
    run: {
      ...run,
      sizeDisplay: formatSize(run.size),
      slNo: 1,
    },
  };
}

export async function buildFurnaceCsv(id) {
  const { run } = await buildFurnaceExport(id);
  const rows = [
    ['field', 'value'],
    ['slNo', '1'],
    ['chargeNo', run.chargeNo],
    ['furnaceCode', run.furnaceCode],
    ['workOrderNo', run.workOrderNo ?? ''],
    ['customerCode', run.customerCode ?? ''],
    ['gradeCode', run.gradeCode ?? ''],
    ['size', run.sizeDisplay ?? ''],
    ['tubeCount', run.tubeCount ?? ''],
    ['totalNos', run.totalNos ?? run.tubeCount ?? ''],
    ['qtyNos', run.qtyNos ?? ''],
    ['qtyMt', run.qtyMt ?? ''],
    ['totalMt', run.totalMt ?? ''],
    ['htType', run.htType ?? ''],
    ['zone1MinC', run.zone1MinC ?? ''],
    ['zone1MaxC', run.zone1MaxC ?? ''],
    ['zone2MinC', run.zone2MinC ?? ''],
    ['zone2MaxC', run.zone2MaxC ?? ''],
    ['zone3MinC', run.zone3MinC ?? ''],
    ['zone3MaxC', run.zone3MaxC ?? ''],
    ['zone4MinC', run.zone4MinC ?? ''],
    ['zone4MaxC', run.zone4MaxC ?? ''],
    ['zone5MinC', run.zone5MinC ?? ''],
    ['zone5MaxC', run.zone5MaxC ?? ''],
    ['zone6MinC', run.zone6MinC ?? ''],
    ['zone6MaxC', run.zone6MaxC ?? ''],
    ['lineSpeedMhr', run.lineSpeedMhr ?? ''],
    ['pngA', run.pngA ?? ''],
    ['pngB', run.pngB ?? ''],
    ['pngC', run.pngC ?? ''],
    ['nh3A', run.nh3A ?? ''],
    ['nh3B', run.nh3B ?? ''],
    ['nh3C', run.nh3C ?? ''],
    ['batchGapOk', run.batchGapOk ?? ''],
    ['disposition', run.disposition ?? ''],
    ['shiftRef', run.shiftRef ?? ''],
    ['prodDate', run.prodDate ?? ''],
    ['remarks', run.remarks ?? ''],
    ['status', run.status],
    ['createdBy', run.createdBy ?? ''],
  ];

  for (const g of run.gasLogs ?? []) {
    rows.push([
      `gas:${g.gasType}`,
      `dew=${g.dewPointC ?? ''} h2=${g.h2Pct ?? ''} o2=${g.o2Ppm ?? ''} flow=${g.gasParams?.flow ?? ''} P=${g.gasParams?.pressure ?? ''}`,
    ]);
  }

  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}
