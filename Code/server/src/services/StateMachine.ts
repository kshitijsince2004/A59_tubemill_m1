import type { MillRunState } from '@a59/shared';

export type MillEvent =
  | 'RUN_OPENED'
  | 'TOOLING_CONFIRMED'
  | 'FIRST_OFF_PASS'
  | 'FIRST_OFF_FAIL'
  | 'LINE_STOPPED'
  | 'LINE_STARTED'
  | 'ROLL_CHANGE'
  | 'RUN_CLOSED';

const transitions: Record<MillRunState, Partial<Record<MillEvent, MillRunState>>> = {
  IDLE: { RUN_OPENED: 'SETUP' },
  SETUP: { TOOLING_CONFIRMED: 'FIRST_OFF_PENDING', RUN_CLOSED: 'RUN_COMPLETE' },
  FIRST_OFF_PENDING: {
    FIRST_OFF_PASS: 'RUNNING',
    FIRST_OFF_FAIL: 'FIRST_OFF_PENDING',
    RUN_CLOSED: 'RUN_COMPLETE',
  },
  RUNNING: {
    LINE_STOPPED: 'STOPPAGE',
    ROLL_CHANGE: 'ROLL_CHANGE',
    RUN_CLOSED: 'RUN_COMPLETE',
  },
  STOPPAGE: {
    LINE_STARTED: 'RUNNING',
    RUN_CLOSED: 'RUN_COMPLETE',
  },
  ROLL_CHANGE: {
    LINE_STARTED: 'RUNNING',
    RUN_CLOSED: 'RUN_COMPLETE',
  },
  RUN_COMPLETE: {},
};

export function transition(current: MillRunState, event: MillEvent): MillRunState {
  const next = transitions[current]?.[event];
  if (!next) {
    throw new Error(`Invalid transition: ${current} + ${event}`);
  }
  return next;
}

export function canCountAsGood(runState: MillRunState, firstOffStatus: string): boolean {
  return runState === 'RUNNING' && firstOffStatus === 'PASS';
}

export function defaultQualityForAutoCount(runState: MillRunState, firstOffStatus: string): 'PRIME' | 'SCRAP' {
  if (canCountAsGood(runState, firstOffStatus)) return 'PRIME';
  return 'SCRAP';
}
