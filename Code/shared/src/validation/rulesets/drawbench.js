import { required, oneOf, lessThan, sumEquals, range, toleranceVsSpec, inMasterBand } from '../rules';

export const drawBenchRules = [
  {
    field: 'workOrderNo',
    label: 'Work Order',
    rules: [required('workOrderNo', 'Work Order')],
  },
  {
    field: 'lotNo',
    label: 'Lot no',
    rules: [required('lotNo', 'Lot no')],
  },
  {
    field: 'benchCode',
    label: 'Bench',
    rules: [required('benchCode', 'Bench')],
  },
  {
    field: 'stage',
    label: 'Inter/Final',
    rules: [oneOf('stage', ['INTER', 'FINAL', ''], 'Inter/Final')],
  },
  {
    field: 'passType',
    label: 'Inter/Final',
    rules: [oneOf('passType', ['INTER', 'FINAL', ''], 'Inter/Final')],
  },
  {
    field: 'drawPass',
    label: 'Pass',
    rules: [oneOf('drawPass', ['1ST', '2ND', '3RD', '1', '2', '3'], 'Pass')],
  },
  {
    field: 'toOdMm',
    label: 'To OD',
    rules: [
      lessThan('toOdMm', 'fromOdMm', 'To OD'),
      inMasterBand('toOdMm', 'finOdMinMm', 'finOdMaxMm', 'Finished OD', 'WARN'),
    ],
  },
  {
    field: 'toThMm',
    label: 'To THK',
    rules: [
      lessThan('toThMm', 'fromThMm', 'To THK', 'WARN'),
      inMasterBand('toThMm', 'finThkMinMm', 'finThkMaxMm', 'Finished THK', 'WARN'),
    ],
  },
  {
    field: 'fromOdMm',
    label: 'From OD',
    rules: [inMasterBand('fromOdMm', 'mhOdMinMm', 'mhOdMaxMm', 'Mother hollow OD', 'WARN')],
  },
  {
    field: 'swageEndMm',
    label: 'Swage end',
    rules: [
      toleranceVsSpec('swageEndMm', 'swageSpecMm', 'swageTol', 'Swage end'),
      inMasterBand('swageEndMm', 'swageEndMinMm', 'swageEndMaxMm', 'Swage end', 'WARN'),
    ],
  },
  {
    field: 'acceptedPcs',
    label: 'Accepted',
    rules: [range('acceptedPcs', 0, 1_000_000, 'Accepted')],
  },
  {
    field: 'inputNos',
    label: 'Input',
    rules: [sumEquals('inputNos', ['acceptedPcs', 'rejectedPcs'], 2, 'Input')],
  },
  {
    field: 'disposition',
    label: 'Disposition',
    rules: [oneOf('disposition', ['OK', 'HOLD', 'REJECT', 'REWORK', ''], 'Disposition')],
  },
];
