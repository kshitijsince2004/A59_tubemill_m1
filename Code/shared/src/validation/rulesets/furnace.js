import { required, range, toleranceVsSpec, oneOf, maxGteMin } from '../rules';

const batchGapWarn =
  (field = 'batchGapOk') =>
  ({ value }) =>
    value === false
      ? {
          field,
          code: 'BATCH_GAP',
          message: 'Batch gap below paper rule (300 mm lot / 6000 mm batch) — supervisor confirm',
          severity: 'WARN',
        }
      : null;

export const furnaceRules = [
  {
    field: 'workOrderNo',
    label: 'Work Order',
    rules: [required('workOrderNo', 'Work Order')],
  },
  {
    field: 'chargeNo',
    label: 'Production run',
    rules: [required('chargeNo', 'Production run')],
  },
  {
    field: 'furnaceCode',
    label: 'Furnace',
    rules: [required('furnaceCode', 'Furnace')],
  },
  {
    field: 'gradeCode',
    label: 'Grade',
    rules: [required('gradeCode', 'Grade')],
  },
  {
    field: 'tubeCount',
    label: 'No. of Tubes',
    rules: [required('tubeCount', 'No. of Tubes'), range('tubeCount', 0, 100000, 'No. of Tubes')],
  },
  {
    field: 'qtyNos',
    label: 'Qty nos',
    rules: [range('qtyNos', 0, 100000, 'Qty nos')],
  },
  {
    field: 'htType',
    label: 'Heat Treatment',
    rules: [required('htType', 'Heat Treatment'), oneOf('htType', ['ANNEAL', 'NORMALIZE', 'SRA'], 'Heat Treatment')],
  },
  {
    field: 'disposition',
    label: 'Disposition',
    rules: [oneOf('disposition', ['ACCEPT', 'QUARANTINE'], 'Disposition')],
  },
  {
    field: 'lineSpeedMhr',
    label: 'Line speed',
    rules: [
      required('lineSpeedMhr', 'Line speed'),
      range('lineSpeedMhr', 0, 500, 'Line speed'),
      toleranceVsSpec('lineSpeedMhr', 'speedSpecMhr', 2, 'Line speed'),
    ],
  },
  ...['zone1', 'zone2', 'zone3', 'zone4', 'zone5', 'zone6'].flatMap((z) => [
    {
      field: `${z}MinC`,
      label: `${z} min`,
      rules: [required(`${z}MinC`, `${z} min`), range(`${z}MinC`, 0, 1200, `${z} min`)],
    },
    {
      field: `${z}MaxC`,
      label: `${z} max`,
      rules: [
        required(`${z}MaxC`, `${z} max`),
        range(`${z}MaxC`, 0, 1200, `${z} max`),
        maxGteMin(`${z}MinC`, `${z}MaxC`, z),
      ],
    },
  ]),
  {
    field: 'zone3MaxC',
    label: 'Soaking max',
    rules: [toleranceVsSpec('zone3MaxC', 'soakingSpecC', 10, 'Soaking temp')],
  },
  {
    field: 'batchGapOk',
    label: 'Batch gap',
    rules: [batchGapWarn('batchGapOk')],
  },
  {
    field: 'lotGapMm',
    label: 'Lot gap mm',
    rules: [
      (ctx) => {
        const n = Number(ctx.value);
        if (ctx.value === '' || ctx.value == null || Number.isNaN(n)) return null;
        return n < 300
          ? {
              field: 'lotGapMm',
              code: 'BATCH_GAP',
              message: `Lot gap ${n} mm below 300 mm paper rule`,
              severity: 'WARN',
            }
          : null;
      },
    ],
  },
  {
    field: 'batchGapMm',
    label: 'Batch spacing mm',
    rules: [
      (ctx) => {
        const n = Number(ctx.value);
        if (ctx.value === '' || ctx.value == null || Number.isNaN(n)) return null;
        return n < 6000
          ? {
              field: 'batchGapMm',
              code: 'BATCH_GAP',
              message: `Piece length ${n} mm below 6000 mm batch spacing rule`,
              severity: 'WARN',
            }
          : null;
      },
    ],
  },
];
