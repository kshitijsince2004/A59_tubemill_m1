/**
 * Minimal boundary checks for shared validation engine (run via tsx).
 */
import { validateRecord, errorsOnly, stpRules, drawBenchRules, furnaceRules } from './index';
import { validateGasPlantReading } from '../furnaceGasPlant.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const stpBad = validateRecord(stpRules, { workOrderNo: 'WO-1', qtyNo: 10, degreaseTempC: 50 });
assert(
  stpBad.some((i) => i.field === 'degreaseTempC' && i.severity === 'WARN'),
  'STP range should warn'
);

const stpMissing = validateRecord(stpRules, { degreaseTempC: 80 });
assert(errorsOnly(stpMissing).some((i) => i.field === 'workOrderNo'), 'WO required');
assert(errorsOnly(stpMissing).some((i) => i.field === 'qtyNo'), 'Qty required');

const stpOk = validateRecord(stpRules, {
  workOrderNo: 'WO-1',
  qtyNo: 10,
  degreaseTempC: 80,
  degreaseTimeMin: 12,
});
assert(errorsOnly(stpOk).length === 0, 'STP in-range should pass');

const drawBad = validateRecord(drawBenchRules, {
  workOrderNo: 'WO-1',
  lotNo: 'L1',
  benchCode: 'DB-60T',
  fromOdMm: 25,
  toOdMm: 30,
});
assert(errorsOnly(drawBad).some((i) => i.field === 'toOdMm'), 'toOd must be < fromOd');

const fur = validateRecord(furnaceRules, {
  workOrderNo: 'WO-1',
  chargeNo: 'C1',
  furnaceCode: 'RHF-03',
  tubeCount: 10,
  htType: 'WRONG',
});
assert(errorsOnly(fur).some((i) => i.field === 'htType'), 'htType enum');

const furZone = validateRecord(furnaceRules, {
  workOrderNo: 'WO-1',
  chargeNo: 'C1',
  furnaceCode: 'RHF-03',
  tubeCount: 10,
  htType: 'ANNEAL',
  zone1MinC: 900,
  zone1MaxC: 800,
});
assert(errorsOnly(furZone).some((i) => i.field === 'zone1MaxC'), 'zone max≥min');

const furTol = validateRecord(
  furnaceRules,
  {
    workOrderNo: 'WO-1',
    chargeNo: 'C1',
    furnaceCode: 'RHF-03',
    tubeCount: 10,
    htType: 'ANNEAL',
    zone3MaxC: 950,
    lineSpeedMhr: 30,
  },
  { master: { soakingSpecC: 900, speedSpecMhr: 20 } }
);
assert(furTol.some((i) => i.field === 'zone3MaxC' && i.severity === 'WARN'), 'soaking tol warn');
assert(furTol.some((i) => i.field === 'lineSpeedMhr' && i.severity === 'WARN'), 'speed tol warn');

const furGap = validateRecord(furnaceRules, {
  workOrderNo: 'WO-1',
  chargeNo: 'C1',
  furnaceCode: 'RHF-03',
  tubeCount: 10,
  htType: 'ANNEAL',
  batchGapOk: false,
  lotGapMm: 100,
});
assert(furGap.some((i) => i.field === 'batchGapOk' && i.severity === 'WARN'), 'batch gap warn');
assert(furGap.some((i) => i.field === 'lotGapMm' && i.severity === 'WARN'), 'lot gap mm warn');

const gasWarn = validateGasPlantReading({
  gasType: 'N2-PSA',
  dewPointC: 0,
  h2Pct: 50,
  o2Ppm: 100,
  gasParams: { rawN2Flow: 10 },
});
assert(gasWarn.some((i) => i.field === 'dewPointC'), 'gas dew warn');
assert(gasWarn.some((i) => i.field === 'gasParams.rawN2Flow'), 'gas matrix warn');

console.log('validation self-test OK');
