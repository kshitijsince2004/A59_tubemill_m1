import { z } from 'zod';

const requiredString = z.string().trim().min(1);
const optionalNumber = z.coerce.number().finite().optional();

export const tmLineStartedSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid().optional(),
  at: z.string().datetime()
});

export const tmLineStoppedSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid().optional(),
  at: z.string().datetime()
});

export const tmPieceCutSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid(),
  countId: requiredString,
  quantity: z.coerce.number().int().positive().default(1),
  at: z.string().datetime()
});

export const tmPowerSampleSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid().optional(),
  speedMpm: optionalNumber,
  powerKw: optionalNumber,
  currentAmp: optionalNumber,
  at: z.string().datetime()
});

/** @typedef {'OPERATOR' | 'MACHINE_HEAD' | 'PLANT_HEAD' | 'ADMIN'} AppRole */

/** @deprecated Use AppRole */
export const UserRole = {
  OPERATOR: 'OPERATOR',
  MACHINE_HEAD: 'MACHINE_HEAD',
  PLANT_HEAD: 'PLANT_HEAD',
  ADMIN: 'ADMIN',
};

/** @type {Record<AppRole, number>} */
export const ROLE_RANK = {
  OPERATOR: 0,
  MACHINE_HEAD: 1,
  PLANT_HEAD: 2,
  ADMIN: 3,
};

export function pickPrimaryRole(roles) {
  if (!roles.length) return 'OPERATOR';
  return roles.reduce((best, r) => ROLE_RANK[r] > ROLE_RANK[best] ? r : best, roles[0]);
}
