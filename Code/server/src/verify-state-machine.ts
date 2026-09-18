import { transition, canCountAsGood, defaultQualityForAutoCount } from './services/StateMachine';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// State machine guards
assert(transition('SETUP', 'TOOLING_CONFIRMED') === 'FIRST_OFF_PENDING', 'setup -> first-off');
assert(transition('FIRST_OFF_PENDING', 'FIRST_OFF_PASS') === 'RUNNING', 'first-off pass -> running');
assert(!canCountAsGood('FIRST_OFF_PENDING', 'PENDING'), 'pre-pass not good');
assert(canCountAsGood('RUNNING', 'PASS'), 'running + pass is good');
assert(defaultQualityForAutoCount('FIRST_OFF_PENDING', 'PENDING') === 'SCRAP', 'pre-pass scrap');
assert(defaultQualityForAutoCount('RUNNING', 'PASS') === 'PRIME', 'running prime');

console.log('State machine verification passed.');
