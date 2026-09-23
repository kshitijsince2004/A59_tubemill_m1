











const transitions = {
  IDLE: {
    RUN_OPENED: 'SETUP',
    PRODUCTION_STARTED: 'RUNNING',
    RUN_CLOSED: 'RUN_COMPLETE'
  },
  SETUP: { TOOLING_CONFIRMED: 'FIRST_OFF_PENDING', RUN_CLOSED: 'RUN_COMPLETE' },
  FIRST_OFF_PENDING: {
    FIRST_OFF_PASS: 'RUNNING',
    FIRST_OFF_FAIL: 'FIRST_OFF_PENDING',
    RUN_CLOSED: 'RUN_COMPLETE'
  },
  RUNNING: {
    LINE_STOPPED: 'STOPPAGE',
    ROLL_CHANGE: 'ROLL_CHANGE',
    RUN_CLOSED: 'RUN_COMPLETE'
  },
  STOPPAGE: {
    LINE_STARTED: 'RUNNING',
    RUN_CLOSED: 'RUN_COMPLETE'
  },
  ROLL_CHANGE: {
    LINE_STARTED: 'RUNNING',
    RUN_CLOSED: 'RUN_COMPLETE'
  },
  RUN_COMPLETE: {}
};

export function transition(current, event) {
  const next = transitions[current]?.[event];
  if (!next) {
    throw new Error(`Invalid transition: ${current} + ${event}`);
  }
  return next;
}

export function canCountAsGood(runState, firstOffStatus) {
  // First-off is independent of production capture — count good while RUNNING.
  return runState === 'RUNNING';
}

export function defaultQualityForAutoCount(runState, firstOffStatus) {
  if (canCountAsGood(runState, firstOffStatus)) return 'PRIME';
  return 'SCRAP';
}