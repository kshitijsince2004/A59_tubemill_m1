/** Field labels for A59 production history cards (TM / FUR / STP / DRW). */

const LABELS = {
  runNo: 'Run',
  mill: 'Mill',
  workOrderNo: 'Work order',
  batch: 'Batch',
  customer: 'Customer',
  grade: 'Grade',
  status: 'Status',
  rawMt: 'Raw MT',
  primeMt: 'Prime MT',
  scrapMt: 'Scrap MT',
  yieldPct: 'Yield %',
  at: 'At',
  chargeNo: 'Charge',
  furnace: 'Furnace',
  htType: 'HT type',
  qtyNos: 'Qty nos',
  qtyMt: 'Qty MT',
  lineSpeed: 'Line speed',
  soakMinC: 'Soak min °C',
  soakMaxC: 'Soak max °C',
  prodDate: 'Prod date',
  lotNo: 'Lot',
  machine: 'Machine',
  surfaceFinish: 'Surface',
  pickleTimeMin: 'Pickle min',
  tagNo: 'Tag',
  bench: 'Bench',
  drawPass: 'Draw pass',
  stage: 'Stage',
  acceptedPcs: 'Accepted pcs',
  rejectedPcs: 'Rejected pcs',
  drawnMetre: 'Drawn m',
  pullLoadT: 'Pull load t',
};

const ORDER_LABELS = {
  batchNumber: 'Batch',
  coilNo: 'Coil',
  slitId: 'Slit / lot',
  sapOrderNo: 'SAP / WO',
  workOrderNo: 'Work order',
  customer: 'Customer',
  grade: 'Grade',
  status: 'Status',
  subProcess: 'Process',
  machine: 'Machine',
  weightMt: 'Weight MT',
  size: 'Size',
};

/**
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function formatHistoryFields(record) {
  if (!record || typeof record !== 'object') return [];
  return Object.entries(record)
    .filter(([, v]) => v != null && v !== '')
    .map(([key, v]) => ({
      key,
      label: LABELS[key] || key,
      value: formatValue(v),
    }));
}

/**
 * @param {Record<string, unknown> | null | undefined} orderInfo
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function formatOrderFields(orderInfo) {
  if (!orderInfo) return [];
  const keys = [
    'batchNumber',
    'coilNo',
    'slitId',
    'sapOrderNo',
    'customer',
    'grade',
    'status',
    'subProcess',
    'machine',
    'weightMt',
    'size',
  ];
  return keys
    .filter((k) => orderInfo[k] != null && orderInfo[k] !== '')
    .map((key) => ({
      key,
      label: ORDER_LABELS[key] || key,
      value: formatValue(orderInfo[key]),
    }));
}

function formatValue(v) {
  if (v instanceof Date) return v.toLocaleString();
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(v);
}

export const PROCESS_BADGE = {
  TM: 'Tube Mill',
  FUR: 'Furnace',
  STP: 'STP',
  DRW: 'Draw Bench',
  SWG: 'Swage',
};
