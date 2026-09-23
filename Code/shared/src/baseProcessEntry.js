import { z } from 'zod';

export const dataSourceSchema = z.enum(['MANUAL', 'PLC', 'SCADA', 'SENSOR', 'API']);


export const entryStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'HOLD']);


export const processCodeSchema = z.enum(['TM', 'FUR', 'STP', 'DRW', 'SWG']);


const optionalString = z.string().trim().optional();
const optionalNumber = z.coerce.number().optional();

export const sizeJsonSchema = z.
object({
  odMm: optionalNumber,
  idMm: optionalNumber,
  thkMm: optionalNumber,
  lengthMm: optionalNumber,
  profile: z.string().optional()
}).
passthrough().
optional();

export const baseProcessEntrySchema = z.object({
  workOrderNo: optionalString,
  customerCode: optionalString,
  gradeCode: optionalString,
  size: sizeJsonSchema,
  shiftRef: optionalString,
  prodDate: z.string().optional(),
  remarks: optionalString,
  dataSource: dataSourceSchema.default('MANUAL'),
  status: entryStatusSchema.default('DRAFT'),
  createdBy: optionalString
});