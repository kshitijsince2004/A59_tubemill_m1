import { z } from 'zod';
import { baseProcessEntrySchema } from './baseProcessEntry';

const optionalNumber = z.coerce.number().optional();
const optionalString = z.string().trim().optional();
const requiredString = z.string().trim().min(1);

export const furCreateSchema = baseProcessEntrySchema.extend({
  chargeNo: requiredString,
  furnaceCode: requiredString,
  tubeCount: z.coerce.number().int().nonnegative().optional(),
  qtyNos: z.coerce.number().int().nonnegative().optional(),
  qtyMt: optionalNumber,
  htType: z.enum(['ANNEAL', 'NORMALIZE', 'SRA']).optional(),
  zone1MinC: optionalNumber,
  zone1MaxC: optionalNumber,
  zone2MinC: optionalNumber,
  zone2MaxC: optionalNumber,
  zone3MinC: optionalNumber,
  zone3MaxC: optionalNumber,
  zone4MinC: optionalNumber,
  zone4MaxC: optionalNumber,
  zone5MinC: optionalNumber,
  zone5MaxC: optionalNumber,
  zone6MinC: optionalNumber,
  zone6MaxC: optionalNumber,
  lineSpeedMhr: optionalNumber,
  totalNos: z.coerce.number().int().optional(),
  totalMt: optionalNumber,
  pngConsumption: optionalNumber,
  nh3Consumption: optionalNumber,
  pngA: optionalNumber,
  pngB: optionalNumber,
  pngC: optionalNumber,
  nh3A: optionalNumber,
  nh3B: optionalNumber,
  nh3C: optionalNumber,
  batchGapOk: z.boolean().optional(),
  lotGapMm: optionalNumber,
  batchGapMm: optionalNumber,
  disposition: z.enum(['ACCEPT', 'QUARANTINE']).optional(),
  materialLotId: optionalString,
  upstreamHandoffId: optionalString
});

export const furUpdateSchema = furCreateSchema.partial().extend({
  id: requiredString
});

export const furGasLogSchema = z.object({
  runId: requiredString,
  loggedAt: z.string().datetime().optional(),
  gasType: z.enum(['N2-PSA', 'EXO']).optional(),
  /** Full hourly matrix from Excel Gas Plant Params — keys vary by N2-PSA vs EXO */
  gasParams: z.record(z.union([z.number(), z.string(), z.null()])).optional(),
  dewPointC: optionalNumber,
  h2Pct: optionalNumber,
  o2Ppm: optionalNumber,
  changeoverTime: z.string().datetime().optional(),
  remarks: optionalString
});

export const furListQuerySchema = z.object({
  status: optionalString,
  furnaceCode: optionalString,
  workOrderNo: optionalString,
  fromDate: optionalString,
  toDate: optionalString
});