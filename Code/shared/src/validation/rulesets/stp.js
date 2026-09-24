import { required, range } from '../rules';

/** Bath process ranges from STP-FT-01A headers — WARN (supervisor flag, not hard stop). */
export const stpRules = [
  {
    field: 'workOrderNo',
    label: 'Work Order',
    rules: [required('workOrderNo', 'Work Order')],
  },
  {
    field: 'qtyNo',
    label: 'Qty',
    // Range only on progressive capture; create/submit enforce presence separately.
    rules: [range('qtyNo', 1, 100000, 'Qty')],
  },
  {
    field: 'degreaseTempC',
    label: 'Degrease temp',
    rules: [range('degreaseTempC', 75, 85, 'Degrease temp', 'WARN')],
  },
  {
    field: 'degreaseTimeMin',
    label: 'Degrease time',
    rules: [range('degreaseTimeMin', 10, 15, 'Degrease time', 'WARN')],
  },
  {
    field: 'descaleTimeMin',
    label: 'Descale time',
    rules: [range('descaleTimeMin', 8, 13, 'Descale time', 'WARN')],
  },
  {
    field: 'pickleTimeMin',
    label: 'Pickle/descale time',
    rules: [range('pickleTimeMin', 8, 13, 'Pickle time', 'WARN')],
  },
  {
    field: 'phosphateTempC',
    label: 'Phosphate temp',
    rules: [range('phosphateTempC', 65, 75, 'Phosphate temp', 'WARN')],
  },
  {
    field: 'phosphateTimeMin',
    label: 'Phosphate time',
    rules: [range('phosphateTimeMin', 6, 11, 'Phosphate time', 'WARN')],
  },
  {
    field: 'neutTempC',
    label: 'Neutralizer temp',
    rules: [range('neutTempC', 50, 60, 'Neutralizer temp', 'WARN')],
  },
  {
    field: 'neutralizerTimeMin',
    label: 'Neutralizer time',
    rules: [range('neutralizerTimeMin', 0, 5, 'Neutralizer time', 'WARN')],
  },
  {
    field: 'lubeTempC',
    label: 'Lube temp',
    rules: [range('lubeTempC', 70, 75, 'Lube temp', 'WARN')],
  },
  {
    field: 'lubeTimeMin',
    label: 'Lube time',
    rules: [range('lubeTimeMin', 7, 12, 'Lube time', 'WARN')],
  },
  {
    field: 'dryerTempC',
    label: 'Dryer temp',
    rules: [range('dryerTempC', 80, 120, 'Dryer temp', 'WARN')],
  },
  {
    field: 'dryerTimeMin',
    label: 'Dryer time',
    rules: [range('dryerTimeMin', 12, 17, 'Dryer time', 'WARN')],
  },
  {
    field: 'sfNeutTempC',
    label: 'SF neutralizer temp',
    rules: [range('sfNeutTempC', 65, 85, 'SF neutralizer temp', 'WARN')],
  },
  {
    field: 'reactiveOilTimeMin',
    label: 'Reactive oil time',
    rules: [range('reactiveOilTimeMin', 8, 10, 'Reactive oil time', 'WARN')],
  },
  {
    field: 'coatingGm2',
    label: 'Coating weight',
    rules: [range('coatingGm2', 4.0, 8.0, 'Coating weight', 'WARN')],
  },
];

/** Lab titration fields — ranges from STP-FT-01A right table / master.stp_bath_spec. */
export const stpBathAnalysisRules = [
  { field: 'degreaseTa', label: 'Degrease TA', rules: [range('degreaseTa', 78, 90, 'Degrease TA', 'WARN')] },
  { field: 'hclPct', label: 'HCl %', rules: [range('hclPct', 6, 22, 'HCl %', 'WARN')] },
  { field: 'fePct', label: 'Fe %', rules: [range('fePct', 0, 10, 'Fe %', 'WARN')] },
  { field: 'activationPh', label: 'Activation pH', rules: [range('activationPh', 7, 8, 'Activation pH', 'WARN')] },
  { field: 'phosTa', label: 'Phos TA', rules: [range('phosTa', 32, 38, 'Phos TA', 'WARN')] },
  { field: 'phosFa', label: 'Phos FA', rules: [range('phosFa', 4, 6, 'Phos FA', 'WARN')] },
  { field: 'phosAcc', label: 'Phos ACC', rules: [range('phosAcc', 3, 5, 'Phos ACC', 'WARN')] },
  { field: 'phosOxta', label: 'Phos OXTA', rules: [range('phosOxta', 18, 22, 'Phos OXTA', 'WARN')] },
  { field: 'neutPh', label: 'Neut pH', rules: [range('neutPh', 8, 10, 'Neut pH', 'WARN')] },
  { field: 'lubeCon', label: 'Lube CON', rules: [range('lubeCon', 4, 6, 'Lube CON', 'WARN')] },
  { field: 'lubeFa', label: 'Lube FA', rules: [range('lubeFa', 0, 1, 'Lube FA', 'WARN')] },
  { field: 'lubePh', label: 'Lube pH', rules: [range('lubePh', 8, 10, 'Lube pH', 'WARN')] },
  { field: 'rinsePh', label: 'Rinse pH', rules: [range('rinsePh', 2, 10, 'Rinse pH', 'WARN')] },
  { field: 'oilWaterAcidNo', label: 'Oil acid no', rules: [range('oilWaterAcidNo', 100, 200, 'Oil acid no', 'WARN')] },
];

/** Maps bath-analysis camelCase fields → master.stp_bath_spec (bath_code, param_key). */
export const STP_BATH_FIELD_SPEC = [
  { field: 'degreaseTa', bathCode: 'DEGREASE', paramKey: 'TA', label: 'Degreasing TA', specText: '78–90 ml' },
  { field: 'hclPct', bathCode: 'PICKLE', paramKey: 'HCl', label: 'HCl pickling', specText: '6–22 %' },
  { field: 'fePct', bathCode: 'PICKLE', paramKey: 'Fe', label: 'Fe', specText: '10 % max' },
  { field: 'activationPh', bathCode: 'ACT', paramKey: 'pH', label: 'Activation pH', specText: '7–8' },
  { field: 'phosTa', bathCode: 'PHOS', paramKey: 'TA', label: 'Phosphating TA', specText: '32–38' },
  { field: 'phosFa', bathCode: 'PHOS', paramKey: 'FA', label: 'Phosphating FA', specText: '4–6' },
  { field: 'phosAcc', bathCode: 'PHOS', paramKey: 'ACC', label: 'Phosphating ACC', specText: '3–5' },
  { field: 'phosOxta', bathCode: 'PHOS', paramKey: 'OXTA', label: 'Phosphating OXTA', specText: '18–22' },
  { field: 'neutPh', bathCode: 'NEUT', paramKey: 'pH', label: 'Neutralizer pH', specText: '8–10' },
  { field: 'lubeCon', bathCode: 'LUBE', paramKey: 'CON', label: 'Lube CON', specText: '4–6 %' },
  { field: 'lubeFa', bathCode: 'LUBE', paramKey: 'FA', label: 'Lube FA', specText: '0–1 %' },
  { field: 'lubePh', bathCode: 'LUBE', paramKey: 'pH', label: 'Lube pH', specText: '8–10' },
  { field: 'rinsePh', bathCode: 'RINSE', paramKey: 'pH', label: 'Water rinse pH', specText: '2–10' },
  { field: 'oilWaterAcidNo', bathCode: 'OIL', paramKey: 'acid_no', label: 'Oil bath acid-no', specText: '100–200' },
];
