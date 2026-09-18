import { z } from 'zod';

const requiredString = z.string().trim().min(1);
const optionalNumber = z.coerce.number().finite().optional();

export const tmLineStartedSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid().optional(),
  at: z.string().datetime(),
});

export const tmLineStoppedSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid().optional(),
  at: z.string().datetime(),
});

export const tmPieceCutSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid(),
  countId: requiredString,
  quantity: z.coerce.number().int().positive().default(1),
  at: z.string().datetime(),
});

export const tmPowerSampleSchema = z.object({
  millCode: requiredString,
  runId: z.string().uuid().optional(),
  speedMpm: optionalNumber,
  powerKw: optionalNumber,
  currentAmp: optionalNumber,
  at: z.string().datetime(),
});

export type TmLineStarted = z.infer<typeof tmLineStartedSchema>;
export type TmLineStopped = z.infer<typeof tmLineStoppedSchema>;
export type TmPieceCut = z.infer<typeof tmPieceCutSchema>;
export type TmPowerSample = z.infer<typeof tmPowerSampleSchema>;

export type TmEventName =
  | 'tm.line_started'
  | 'tm.line_stopped'
  | 'tm.piece_cut'
  | 'tm.power_sample'
  | 'tm.run_opened'
  | 'tm.setup_approved'
  | 'tm.machine_state'
  | 'tm.run_closed';

export interface RunOpenedEvent {
  runId: string;
  millCode: string;
  workOrderNo: string;
  sizeKey: string;
  gradeCode: string;
  openedAt: string;
}

export interface SetupApprovedEvent {
  runId: string;
  setupId: string;
  firstOffResult: 'PASS' | 'FAIL';
  approvedBy: string;
  approvedAt: string;
}

export interface MachineStateEvent {
  millCode: string;
  runId?: string;
  state: string;
  at: string;
}

export interface PowerSampleEvent {
  millCode: string;
  runId?: string;
  speedMpm?: number;
  powerKw?: number;
  currentAmp?: number;
  inBand: boolean;
  at: string;
}

export interface RunClosedEvent {
  runId: string;
  millCode: string;
  rawMaterialMt: number;
  acceptedMt: number;
  yieldPct: number;
  closedAt: string;
}

export type AppRole = 'OPERATOR' | 'SUPERVISOR' | 'PLANT_HEAD' | 'ADMIN';

/** @deprecated Use AppRole */
export type DemoRole = AppRole;
