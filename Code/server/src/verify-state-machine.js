import { transition, canCountAsGood, defaultQualityForAutoCount } from './services/StateMachine';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// State machine guards
assert(transition('IDLE', 'PRODUCTION_STARTED') === 'RUNNING', 'idle -> running (manual start)');
assert(transition('SETUP', 'TOOLING_CONFIRMED') === 'FIRST_OFF_PENDING', 'setup -> first-off');
assert(transition('FIRST_OFF_PENDING', 'FIRST_OFF_PASS') === 'RUNNING', 'first-off pass -> running');
assert(transition('RUNNING', 'LINE_STOPPED') === 'STOPPAGE', 'running -> stoppage');
assert(transition('STOPPAGE', 'LINE_STARTED') === 'RUNNING', 'stoppage -> running');
assert(transition('RUNNING', 'RUN_CLOSED') === 'RUN_COMPLETE', 'running -> complete');
assert(!canCountAsGood('FIRST_OFF_PENDING', 'PENDING'), 'pre-pass not good');
assert(canCountAsGood('RUNNING', 'PASS'), 'running is good');
assert(canCountAsGood('RUNNING', 'PENDING'), 'running without first-off is good');
assert(defaultQualityForAutoCount('FIRST_OFF_PENDING', 'PENDING') === 'SCRAP', 'pre-pass scrap');
assert(defaultQualityForAutoCount('RUNNING', 'PASS') === 'PRIME', 'running prime');

console.log('State machine verification passed.');