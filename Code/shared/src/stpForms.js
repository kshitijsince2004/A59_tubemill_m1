import { z } from 'zod';
import { baseProcessEntrySchema } from './baseProcessEntry';

const optionalNumber = z.coerce.number().optional();
const optionalString = z.string().trim().optional();
const requiredString = z.string().trim().min(1);

export const stpCreateSchema = baseProcessEntrySchema.extend({
  lotNo: requiredString,
  machineCode: optionalString,
  workOrderLineNo: z.coerce.number().int().positive().optional(),
  qtyNo: z.coerce.number().int().optional(),
  qtyMt: optionalNumber,
  degreaseTempC: optionalNumber,
  degreaseTimeMin: optionalNumber,
  pickleTimeMin: optionalNumber,
  descaleTimeMin: optionalNumber,
  phosphateTempC: optionalNumber,
  phosphateTimeMin: optionalNumber,
  neutralizerTimeMin: optionalNumber,
  neutTempC: optionalNumber,
  lubeTempC: optionalNumber,
  lubeTimeMin: optionalNumber,
  dryerTempC: optionalNumber,
  dryerTimeMin: optionalNumber,
  reactiveOilTimeMin: optionalNumber,
  sfNeutTempC: optionalNumber,
  surfaceFinish: optionalString,
  chemAddition: optionalString,
  breakdownRemark: optionalString,
  craneState: optionalString,
  disposition: z.enum(['ACCEPT', 'QUARANTINE']).optional(),
  materialLotId: optionalString,
  upstreamHandoffId: optionalString
});

export const stpUpdateSchema = stpCreateSchema.partial().extend({
  id: requiredString
});

export const stpBathAnalysisSchema = z.object({
  lotId: optionalString,
  sampledAt: z.string().datetime().optional(),
  degreaseTa: optionalNumber,
  hclPct: optionalNumber,
  fePct: optionalNumber,
  activationPh: optionalNumber,
  phosTa: optionalNumber,
  phosFa: optionalNumber,
  phosAcc: optionalNumber,
  phosOxta: optionalNumber,
  neutPh: optionalNumber,
  lubeCon: optionalNumber,
  lubeFa: optionalNumber,
  lubePh: optionalNumber,
  rinsePh: optionalNumber,
  oilWaterAcidNo: optionalNumber,
  remarks: optionalString
});

export const stpChemicalAdditionSchema = z.object({
  lotId: optionalString,
  bathCode: requiredString,
  chemical: requiredString,
  quantity: optionalNumber,
  unit: optionalString,
  batchRef: optionalString,
  remarks: optionalString,
  createdBy: optionalString
});

export const stpCoatingSchema = z.object({
  lotId: optionalString,
  sampleDate: optionalString,
  coatingGm2: optionalNumber,
  sampleNo: z.coerce.number().int().optional(),
  remarks: optionalString
});

export const stpBathHistorySchema = z.object({
  bathCode: requiredString,
  plannedChangeDate: optionalString,
  executedChangeDate: optionalString,
  plannedFreqDays: z.coerce.number().int().optional(),
  remarks: optionalString
});

export const stpListQuerySchema = z.object({
  status: optionalString,
  workOrderNo: optionalString,
  fromDate: optionalString,
  toDate: optionalString
});