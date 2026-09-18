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
  lengthMm: optionalPositiveNumber,
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
  runState: z
    .enum(['IDLE', 'SETUP', 'FIRST_OFF_PENDING', 'RUNNING', 'STOPPAGE', 'ROLL_CHANGE', 'RUN_COMPLETE'])
    .default('SETUP'),
  firstOffStatus: z.enum(['PENDING', 'PASS', 'FAIL']).default('PENDING'),
  remarks: optionalString,
});

export const tmSetupSchema = z.object({
  runId: requiredString,
  setupType: z.enum(['INITIAL', 'REGULAR']),
  reason: z
    .enum(['NEW_PRODUCT', 'SIZE_CHANGE', 'SHIFT_CHANGE', 'POWER_FAILURE', 'BREAKDOWN', 'ROLL_CHANGE'])
    .optional(),
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
});

export const tmBundleSchema = z.object({
  runId: requiredString,
  bundleNo: z.coerce.number().int().positive(),
  pieces: z.coerce.number().int().nonnegative(),
  lengthMm: optionalPositiveNumber,
  weightKg: optionalPositiveNumber,
  weightSource: z.enum(['DERIVED', 'MEASURED']).default('DERIVED'),
  qualityClass: z.enum(['PRIME', 'PQ2', 'CQ', 'OPEN', 'SCRAP']),
  pq2Reason: z.enum(['JOINT', 'OTHER']).optional(),
});

export const tmParamSnapshotSchema = z.object({
  runId: requiredString,
  tsHour: z.string().datetime(),
  lineSpeedMpm: optionalPositiveNumber,
  weldPowerKw: optionalPositiveNumber,
  weldCurrentAmp: optionalPositiveNumber,
  coolantPressureKg: optionalPositiveNumber,
  coolantOilPct: optionalPositiveNumber,
  wiperChange: z.boolean().optional(),
});

export const tmFirstOffSchema = z.object({
  result: z.enum(['PASS', 'FAIL']),
  approvedBy: requiredString,
});

export const tmStoppageCodeSchema = z.object({
  stoppageCode: requiredString,
  reason: optionalString,
  remark: optionalString,
});

export const tmParamManualSchema = z.object({
  coolantOilPct: optionalPositiveNumber,
  wiperChange: z.boolean().optional(),
  coolantPressureKg: optionalPositiveNumber,
  remarks: optionalString,
});

export const openRunSchema = z.object({
  queueCardId: requiredString,
  millCode: requiredString.default('A-59'),
  setupType: z.enum(['INITIAL', 'REGULAR']).default('INITIAL'),
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
  remark: optionalString,
});

export const tmArcWeldSchema = z.object({
  coilInputId: requiredString,
  runId: optionalString,
  currentAmp: optionalPositiveNumber,
  thkMm: optionalPositiveNumber,
  gradeCode: optionalString,
  operatorRef: optionalString,
  remark: optionalString,
});

export const tmDefectSchema = z.object({
  defectCode: requiredString,
  quantityMt: optionalPositiveNumber,
  pieces: z.coerce.number().int().nonnegative().optional(),
  remark: optionalString,
});

export const tmHoldSchema = z.object({
  remark: optionalString,
});

export const tmRemarkSchema = z.object({
  remark: requiredString,
});

export const tmManualStopSchema = z.object({
  stoppageCode: optionalString,
  reason: optionalString,
  remark: optionalString,
});

export type M1TubeMillRunForm = z.infer<typeof tmRunSchema>;
export type M1TmSetupForm = z.infer<typeof tmSetupSchema>;
export type M1TmCoilInputForm = z.infer<typeof tmCoilInputSchema>;
export type M1TmBundleForm = z.infer<typeof tmBundleSchema>;
export type M1TmParamSnapshotForm = z.infer<typeof tmParamSnapshotSchema>;
export type M1TmFirstOffForm = z.infer<typeof tmFirstOffSchema>;
export type M1TmStoppageCodeForm = z.infer<typeof tmStoppageCodeSchema>;
export type M1TmParamManualForm = z.infer<typeof tmParamManualSchema>;
export type M1OpenRunForm = z.infer<typeof openRunSchema>;
export type M1TmEdgeMillForm = z.infer<typeof tmEdgeMillSchema>;
export type M1TmArcWeldForm = z.infer<typeof tmArcWeldSchema>;
export type M1TmDefectForm = z.infer<typeof tmDefectSchema>;
export type M1TmHoldForm = z.infer<typeof tmHoldSchema>;
export type M1TmRemarkForm = z.infer<typeof tmRemarkSchema>;
export type M1TmManualStopForm = z.infer<typeof tmManualStopSchema>;

export type MillRunState =
  | 'IDLE'
  | 'SETUP'
  | 'FIRST_OFF_PENDING'
  | 'RUNNING'
  | 'STOPPAGE'
  | 'ROLL_CHANGE'
  | 'RUN_COMPLETE';

export type QualityClass = 'PRIME' | 'PQ2' | 'CQ' | 'OPEN' | 'SCRAP';
