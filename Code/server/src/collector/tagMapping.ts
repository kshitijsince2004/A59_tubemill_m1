import type { PlcSignal } from './types';

/** Maps PLC signals to canonical field names used in ingest / live strip. */
export const TAG_TO_CANONICAL: Record<PlcSignal, string> = {
  LINE_SPEED: 'speedMpm',
  WELD_POWER: 'powerKw',
  WELD_CURRENT: 'currentAmp',
  RUN_STATE: 'lineRunning',
  CUT_COUNT: 'pieceCount',
  COOLANT_PRESSURE: 'coolantPressureKg',
};

export const A59_SIGNAL_DEFS: { signal: PlcSignal; unit: string; controller: string }[] = [
  { signal: 'LINE_SPEED', unit: 'mpm', controller: 'LINE-PLC' },
  { signal: 'WELD_POWER', unit: 'kW', controller: 'WELDER-SCADA' },
  { signal: 'WELD_CURRENT', unit: 'A', controller: 'WELDER-SCADA' },
  { signal: 'RUN_STATE', unit: 'bool', controller: 'LINE-PLC' },
  { signal: 'CUT_COUNT', unit: 'pcs', controller: 'COC-SAW' },
  { signal: 'COOLANT_PRESSURE', unit: 'kg', controller: 'LINE-PLC' },
];
