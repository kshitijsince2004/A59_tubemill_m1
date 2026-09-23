import { z } from 'zod';
import { baseProcessEntrySchema, sizeJsonSchema } from './baseProcessEntry';

const optionalNumber = z.coerce.number().optional();
const optionalString = z.string().trim().optional();
const requiredString = z.string().trim().min(1);

export const drawPassSchema = z.enum(['1ST', '2ND', '3RD']);
export const drawStageSchema = z.enum(['INTER', 'FINAL']);

export const drwCreateSchema = baseProcessEntrySchema.extend({
  lotNo: requiredString,
  benchCode: requiredString,
  drawPass: drawPassSchema.default('1ST'),
  inputTubeRef: optionalString,
  operatorRef: optionalString,
  finalSize: sizeJsonSchema,
  fromSize: sizeJsonSchema,
  toSize: sizeJsonSchema,
  fromOdMm: optionalNumber,
  fromThMm: optionalNumber,
  fromLenMm: optionalNumber,
  toOdMm: optionalNumber,
  toIdMm: optionalNumber,
  toThMm: optionalNumber,
  toLenMm: optionalNumber,
  finalOdMm: optionalNumber,
  finalIdMm: optionalNumber,
  finalThMm: optionalNumber,
  finalLenMm: optionalNumber,
  drawPlanLenMm: optionalNumber,
  stage: drawStageSchema.optional(),
  passType: drawStageSchema.optional(),
  acceptedPcs: z.coerce.number().int().nonnegative().optional(),
  acceptedMt: optionalNumber,
  rejectedPcs: z.coerce.number().int().nonnegative().optional(),
  inputNos: z.coerce.number().int().nonnegative().optional(),
  drawnMetre: optionalNumber,
  pullLoadT: optionalNumber,
  cycleTimeS: optionalNumber,
  breakdownRemark: optionalString,
  tagNo: optionalString,
  paintColour: optionalString,
  swageEndMm: optionalNumber,
  customerName: optionalString,
  supervisorRef: optionalString,
  shiftInchargeRef: optionalString,
  specialControl: z
    .enum(['NEW_SIZE', '4M', 'CUSTOMER_CONCERN', 'MASS', 'SHIFT_CHANGE'])
    .optional(),
  materialLotId: optionalString,
  upstreamHandoffId: optionalString
});

export const drwUpdateSchema = drwCreateSchema.partial().extend({
  id: requiredString
});

export const drwShiftCheckSchema = z.object({
  lotId: optionalString,
  benchCode: requiredString,
  checkDate: optionalString,
  shiftRef: optionalString,
  cleanOk: z.boolean().optional(),
  diePlugOk: z.boolean().optional(),
  lubeOk: z.boolean().optional(),
  pressureOk: z.boolean().optional(),
  inputLubeOk: z.boolean().optional(),
  drawSpeedSet: optionalNumber,
  noiseOk: z.boolean().optional(),
  remarks: optionalString,
  createdBy: optionalString
});

export const drwInspectionSchema = z.object({
  lotId: requiredString,
  inspectionType: z.enum(['FIRST_OFF', 'LAST_OFF']).optional(),
  odMm: optionalNumber,
  idMm: optionalNumber,
  thkMm: optionalNumber,
  lenMm: optionalNumber,
  formDevMm: optionalNumber,
  surfaceRa: optionalNumber,
  surface: optionalString,
  surfaceOk: z.boolean().optional(),
  firstOffOk: z.boolean().optional(),
  lastOffOk: z.boolean().optional(),
  refirstoffOk: z.boolean().optional(),
  disposition: z.enum(['OK', 'HOLD', 'REJECT', 'REWORK']).optional(),
  specialControl: z
    .enum(['NEW_SIZE', '4M', 'CUSTOMER_CONCERN', 'MASS', 'SHIFT_CHANGE'])
    .optional(),
  remarks: optionalString
});

export const drwToolingIssueSchema = z.object({
  lotId: requiredString,
  issueSize: optionalString,
  dieCode: optionalString,
  stage: optionalString,
  dieSizeMm: optionalNumber,
  actualOd1stoffMm: optionalNumber,
  dieCondition: optionalString,
  plugStage: optionalString,
  plugSizeMm: optionalNumber,
  plugCondition: optionalString
});

export const drwToolingUsageSchema = z.object({
  dieCode: requiredString,
  lotId: optionalString,
  useDate: optionalString,
  prevDrawOdMm: optionalNumber,
  tubesProduced: z.coerce.number().int().optional(),
  inputSize: sizeJsonSchema,
  diePolish: z.boolean().optional(),
  oversized: z.boolean().optional(),
  disposition: optionalString,
  remarks: optionalString
});

export const drwSwageSchema = z.object({
  lotNo: requiredString,
  linkedDbLotId: optionalString,
  swgMachine: optionalString,
  workOrderNo: optionalString,
  customerCode: optionalString,
  gradeCode: optionalString,
  size: sizeJsonSchema,
  swgDie: optionalString,
  drawSize: sizeJsonSchema,
  tagLenMm: optionalNumber,
  lenAfterDieMm: optionalNumber,
  pieces: z.coerce.number().int().optional(),
  tagNo: optionalString,
  shiftRef: optionalString,
  prodDate: optionalString,
  remarks: optionalString,
  materialLotId: optionalString,
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'HOLD']).optional(),
  dataSource: z.enum(['MANUAL', 'PLC', 'SCADA', 'SENSOR', 'API']).default('MANUAL'),
  createdBy: optionalString
});

export const drwListQuerySchema = z.object({
  status: optionalString,
  benchCode: optionalString,
  workOrderNo: optionalString,
  drawPass: optionalString,
  fromDate: optionalString,
  toDate: optionalString
});