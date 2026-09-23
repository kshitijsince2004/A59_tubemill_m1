import { z } from 'zod';

const optionalPositiveNumber = z.coerce.number().positive().optional();
const optionalString = z.string().trim().optional();
const requiredString = z.string().trim().min(1);

export const tmSizeSchema = z.object({
  profile: z.enum(['ROUND', 'SECTION']),
  odMm: optionalPositiveNumber,
  aMm: optionalPositiveNumber,
  bMm: optionalPositiveNumber,
  equivOdMm: optionalPositiveNumber,
  thkMm: optionalPositiveNumber,
  swg: optionalString,
  lengthMm: optionalPositiveNumber
});

export const tmRunSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  runNo: requiredString,
  millCode: requiredString,
  workOrderNo: optionalString,
  bcBatchNumber: optionalString,
  customerCode: optionalString,
  gradeCode: optionalString,
  size: tmSizeSchema,
  sizeKey: requiredString,
  sourceTag: z.enum(['PLAN', 'JOURNEY']).default('PLAN'),
  runState: z.
  enum(['IDLE', 'SETUP', 'FIRST_OFF_PENDING', 'RUNNING', 'STOPPAGE', 'ROLL_CHANGE', 'RUN_COMPLETE']).
  default('SETUP'),
  firstOffStatus: z.enum(['PENDING', 'PASS', 'FAIL']).default('PENDING'),
  remarks: optionalString
});

export const tmSetupSchema = z.object({
  runId: requiredString,
  setupType: z.enum(['INITIAL', 'REGULAR']),
  reason: z.
  enum(['NEW_PRODUCT', 'SIZE_CHANGE', 'SHIFT_CHANGE', 'POWER_FAILURE', 'BREAKDOWN', 'ROLL_CHANGE']).
  optional(),
  idTool: optionalString,
  odTool: optionalString,
  boggieSize: optionalString,
  impederSize: optionalString,
  ferriteRod: optionalString,
  ssRod: optionalString,
  workCoilId: optionalString,
  vLengthMm: optionalPositiveNumber,
  vGapMm: optionalPositiveNumber,
  wcToWrDistanceMm: optionalPositiveNumber,
  weldDiaMm: optionalPositiveNumber,
  argonUsed: z.boolean().optional(),
  is4mChange: z.boolean().optional(),
  m4Category: z.enum(['MAN', 'MATERIAL', 'MACHINE', 'METHOD']).optional(),
  weldFlowOk: z.boolean().optional(),
  ectCalibrated: z.boolean().optional(),
  coolantConcPct: optionalPositiveNumber,
  coolantPressureKg: optionalPositiveNumber,
  wiperUsed: z.boolean().optional(),
  slitThkMm: optionalPositiveNumber,
  slitWidthMm: optionalPositiveNumber,
  rollSet: optionalString,
  speedMpmObs: optionalPositiveNumber,
  powerKwObs: optionalPositiveNumber,
  firstOffDims: z.record(z.unknown()).optional(),
  firstOffForm: z.record(z.unknown()).optional(),
  weldFlowSurfaceVangle: optionalString,
  finPassDims: z.record(z.unknown()).optional()
});

export const tmCoilInputSchema = z.object({
  runId: requiredString,
  coilTag: requiredString,
  gradeCode: optionalString,
  widthMm: optionalPositiveNumber,
  thkMm: optionalPositiveNumber,
  swg: optionalString,
  inputWeightKg: optionalPositiveNumber,
  spliceSeq: z.coerce.number().int().optional(),
  jointMarker: z.boolean().optional(),
  slitHardness: optionalPositiveNumber,
  widthSMm: optionalPositiveNumber,
  widthMMm: optionalPositiveNumber,
  widthEMm: optionalPositiveNumber,
  thkSMm: optionalPositiveNumber,
  thkMMm: optionalPositiveNumber,
  thkEMm: optionalPositiveNumber,
  rejectionRemark: optionalString,
  workOrderNo: optionalString
});

export const tmOnlineInspectionSchema = z.object({
  runId: requiredString,
  lotCoilRef: optionalString,
  odMm: optionalPositiveNumber,
  thkMm: optionalPositiveNumber,
  lengthMm: optionalPositiveNumber,
  ovalityMm: optionalPositiveNumber,
  straightnessMm: optionalPositiveNumber,
  weldBeadOk: z.boolean().optional(),
  flatteningOk: z.boolean().optional(),
  driftingOk: z.boolean().optional(),
  utEctResult: optionalString,
  surfaceOk: z.boolean().optional(),
  gaugeOk: z.boolean().optional(),
  qaClass: optionalString,
  workOrderNo: optionalString,
  remarks: optionalString
});

export const tmBundleSchema = z.object({
  runId: requiredString,
  bundleNo: z.coerce.number().int().positive(),
  pieces: z.coerce.number().int().nonnegative(),
  lengthMm: optionalPositiveNumber,
  weightKg: optionalPositiveNumber,
  weightSource: z.enum(['DERIVED', 'MEASURED']).default('DERIVED'),
  qualityClass: z.enum(['PRIME', 'PQ2', 'CQ', 'OPEN', 'SCRAP']),
  pq2Reason: z.enum(['JOINT', 'OTHER']).optional()
});

export const tmParamSnapshotSchema = z.object({
  runId: requiredString,
  tsHour: z.string().datetime(),
  lineSpeedMpm: optionalPositiveNumber,
  weldPowerKw: optionalPositiveNumber,
  weldCurrentAmp: optionalPositiveNumber,
  coolantPressureKg: optionalPositiveNumber,
  coolantOilPct: optionalPositiveNumber,
  wiperChange: z.boolean().optional()
});

export const tmFirstOffSchema = z.object({
  result: z.enum(['PASS', 'FAIL']),
  approvedBy: requiredString
});

export const tmStoppageCodeSchema = z.object({
  stoppageCode: requiredString,
  reason: optionalString,
  remark: optionalString
});

export const tmParamManualSchema = z.object({
  coolantOilPct: optionalPositiveNumber,
  wiperChange: z.boolean().optional(),
  coolantPressureKg: optionalPositiveNumber,
  remarks: optionalString,
  argonUsed: z.boolean().optional(),
  signRef: optionalString,
  millCode: optionalString,
  prodDate: optionalString,
  shiftRef: optionalString
});

/** Machine-scoped TM-04 reading (independent of production run). */
export const tmMillParamManualSchema = z.object({
  millCode: requiredString.default('A-59'),
  /** MANUAL until PLC — speed / power / WC-WR */
  speedMpm: optionalPositiveNumber,
  powerKw: optionalPositiveNumber,
  wcToWrDistanceMm: optionalPositiveNumber,
  coolantOilPct: optionalPositiveNumber,
  wiperChange: z.boolean().optional(),
  coolantPressureKg: optionalPositiveNumber,
  argonUsed: z.boolean().optional(),
  remarks: optionalString,
  signRef: optionalString,
  prodDate: optionalString,
  shiftRef: optionalString
});

/** Machine-scoped TM-05 setup (independent of production run / WO). */
export const tmMillSetupSchema = z.object({
  millCode: requiredString.default('A-59'),
  setupType: z.enum(['INITIAL', 'REGULAR']).default('INITIAL'),
  reason: z.
  enum(['NEW_PRODUCT', 'SIZE_CHANGE', 'SHIFT_CHANGE', 'POWER_FAILURE', 'BREAKDOWN', 'ROLL_CHANGE']).
  optional(),
  sizeKey: optionalString,
  gradeCode: optionalString,
  thkMm: optionalPositiveNumber,
  note: optionalString,
  idTool: optionalString,
  odTool: optionalString,
  boggieSize: optionalString,
  impederSize: optionalString,
  ferriteRod: optionalString,
  ssRod: optionalString,
  workCoilId: optionalString,
  seamGuide: optionalString,
  vLengthMm: optionalPositiveNumber,
  vGapMm: optionalPositiveNumber,
  wcToWrDistanceMm: optionalPositiveNumber,
  weldDiaMm: optionalPositiveNumber,
  argonUsed: z.boolean().optional(),
  is4mChange: z.boolean().optional(),
  m4Category: z.enum(['MAN', 'MATERIAL', 'MACHINE', 'METHOD']).optional(),
  weldFlowOk: z.boolean().optional(),
  ectCalibrated: z.boolean().optional(),
  coolantConcPct: optionalPositiveNumber,
  coolantPressureKg: optionalPositiveNumber,
  wiperUsed: z.boolean().optional(),
  slitThkMm: optionalPositiveNumber,
  slitWidthMm: optionalPositiveNumber,
  rollSet: optionalString,
  speedMpmObs: optionalPositiveNumber,
  powerKwObs: optionalPositiveNumber,
  firstOffDims: z.record(z.unknown()).optional(),
  firstOffForm: z.record(z.unknown()).optional(),
  weldFlowSurfaceVangle: optionalString,
  finPassDims: z.record(z.unknown()).optional(),
  firstOffResult: z.enum(['PASS', 'FAIL', 'PENDING']).optional()
});

export const openRunSchema = z.object({
  queueCardId: requiredString,
  millCode: requiredString.default('A-59'),
  setupType: z.enum(['INITIAL', 'REGULAR']).default('INITIAL')
});

export const tmEdgeMillSchema = z.object({
  runId: optionalString,
  coilInputId: optionalString,
  od: optionalString,
  thkMm: optionalPositiveNumber,
  gradeCode: optionalString,
  widthBeforeMm: optionalPositiveNumber,
  widthAfterMm: optionalPositiveNumber,
  edgeCondition: optionalString,
  operatorRef: optionalString,
  remark: optionalString
});

export const tmArcWeldSchema = z.object({
  coilInputId: requiredString,
  runId: optionalString,
  currentAmp: optionalPositiveNumber,
  thkMm: optionalPositiveNumber,
  gradeCode: optionalString,
  operatorRef: optionalString,
  remark: optionalString
});

export const tmDefectSchema = z.object({
  defectCode: requiredString,
  quantityMt: optionalPositiveNumber,
  pieces: z.coerce.number().int().nonnegative().optional(),
  remark: optionalString
});

export const tmHoldSchema = z.object({
  remark: optionalString
});

export const tmRemarkSchema = z.object({
  remark: requiredString
});

export const tmManualStopSchema = z.object({
  stoppageCode: requiredString,
  reason: requiredString,
  remark: optionalString
});

/** Production Console quantity upsert (PRD-06..17). Null clears; omit to leave unchanged.
 * Coerce numeric strings from JSON clients; reject empty string as invalid.
 */
const optionalNullableInt = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return v;
  },
  z.union([z.number().int().nonnegative(), z.null()]).optional()
);
const optionalNullableNonneg = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return v;
  },
  z.union([z.number().nonnegative(), z.null()]).optional()
);

export const tmProductionQuantitiesSchema = z.object({
  primeNo: optionalNullableInt,
  pq2JointNo: optionalNullableInt,
  pq2OtherNo: optionalNullableInt,
  cqNo: optionalNullableInt,
  openNo: optionalNullableInt,
  scrapWtMt: optionalNullableNonneg
});

export const tmEndRunSchema = z.object({
  remark: optionalString
});