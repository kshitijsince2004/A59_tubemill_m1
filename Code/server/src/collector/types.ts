export type PlcSignal =
  | 'LINE_SPEED'
  | 'WELD_POWER'
  | 'WELD_CURRENT'
  | 'RUN_STATE'
  | 'CUT_COUNT'
  | 'COOLANT_PRESSURE';

export interface PlcPollReading {
  signal: PlcSignal;
  value: number;
  unit?: string;
  at: string;
}

export interface PlcDriver {
  millCode: string;
  start(runId: string): void;
  stop(runId: string): void;
  poll(runId: string): PlcPollReading[];
  setForceOutOfBand(runId: string, force: boolean): void;
  getLiveSnapshot(runId: string): {
    speedMpm: number;
    powerKw: number;
    currentAmp: number;
    pieceCount: number;
    lineRunning: boolean;
    forceOutOfBand: boolean;
  } | null;
}
