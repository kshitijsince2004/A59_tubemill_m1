/**
 * Gas plant param matrices from Zedral_A59_Furnace_M1_Data_Mapping.xlsx
 * (Gas Plant Params tab). Stored in txn.ann_gas_log.gas_params jsonb.
 */

/** @typedef {{ key: string, label: string, unit: string, min: number, max: number }} GasParamDef */

/** @type {GasParamDef[]} */
export const N2_PSA_PARAMS = [
  { key: 'inletWaterPressure', label: 'Inlet water pressure', unit: 'kg/cm2', min: 1.5, max: 3.0 },
  { key: 'dischargeTempC', label: 'Discharge temp', unit: 'C', min: 75, max: 110 },
  { key: 'airReceiverPressure', label: 'Air receiver pressure', unit: 'kg/cm2', min: 6.5, max: 7.2 },
  { key: 'psaTowerPressureA', label: 'PSA tower pressure A', unit: 'kg/cm2', min: 6.5, max: 7.2 },
  { key: 'psaTowerPressureB', label: 'PSA tower pressure B', unit: 'kg/cm2', min: 6.5, max: 7.2 },
  { key: 'rawN2Flow', label: 'Raw N2 flow', unit: 'Nm3/hr', min: 150, max: 300 },
  { key: 'nh3InletPressure', label: 'NH3 inlet pressure', unit: 'kg/cm2', min: 5.0, max: 6.5 },
  { key: 'crackedNh3Flow', label: 'Cracked NH3 flow', unit: 'Nm3/hr', min: 5, max: 40 },
  { key: 'deoxoTempC', label: 'Deoxo temp', unit: 'C', min: 50, max: 400 },
  { key: 'dryerTowerPressureA', label: 'N2 dryer tower A pressure', unit: 'kg/cm2', min: 4.0, max: 5.5 },
  { key: 'dryerTowerPressureB', label: 'N2 dryer tower B pressure', unit: 'kg/cm2', min: 4.0, max: 5.5 },
  { key: 'dryerTowerTempA', label: 'N2 dryer tower A temp', unit: 'C', min: 20, max: 220 },
  { key: 'dryerTowerTempB', label: 'N2 dryer tower B temp', unit: 'C', min: 20, max: 220 },
];

/** @type {GasParamDef[]} */
export const EXO_PARAMS = [
  { key: 'mainPressurePng', label: 'Main pressure PNG', unit: 'kg/cm2', min: 2.0, max: 3.5 },
  { key: 'secondaryPressurePng', label: 'Secondary pressure PNG', unit: 'Nm3/hr', min: 0.1, max: 0.5 },
  { key: 'pngFlow', label: 'PNG flow', unit: 'Nm3/hr', min: 18, max: 40 },
  { key: 'combustionAir', label: 'Combustion air', unit: 'Nm3/hr', min: 120, max: 300 },
  { key: 'combustionChamberTempC', label: 'Combustion chamber temp', unit: 'C', min: 35, max: 80 },
  { key: 'inletWaterPressure', label: 'Inlet water pressure', unit: 'kg/cm2', min: 1.0, max: 2.5 },
  { key: 'airBlowerPressure', label: 'Air blower pressure', unit: 'kg/cm2', min: 0.15, max: 0.5 },
  { key: 'deoxoPressure', label: 'Deoxo pressure', unit: 'Nm3', min: 0.05, max: 0.5 },
  { key: 'chillerInletTempC', label: 'Chiller inlet temp', unit: 'C', min: 5, max: 65 },
  { key: 'chillerOutletTempC', label: 'Chiller outlet temp', unit: 'C', min: 3, max: 20 },
  { key: 'chillerSuctionPsi', label: 'Chiller suction pressure', unit: 'PSI', min: 0, max: 65 },
  { key: 'chillerDischargePsi', label: 'Chiller discharge pressure', unit: 'PSI', min: 180, max: 300 },
];

/** Top-level quality columns (GAS-03…05) with Excel ranges by plant type. */
export const GAS_QUALITY_RANGES = {
  'N2-PSA': {
    dewPointC: { min: -110, max: -40, label: 'Dew point' },
    h2Pct: { min: 1, max: 10, label: 'Final H2 %' },
    o2Ppm: { min: 0, max: 10, label: 'O2 product gas' },
  },
  EXO: {
    dewPointC: { min: -45, max: 20, label: 'Dew point' },
    h2Pct: { min: 0.1, max: 5.0, label: 'H2 %' },
    o2Ppm: { min: 0, max: 10, label: 'O2 product gas' },
  },
};

export function gasParamDefsFor(gasType) {
  return gasType === 'EXO' ? EXO_PARAMS : N2_PSA_PARAMS;
}

export function emptyGasParams(gasType) {
  const out = {};
  for (const p of gasParamDefsFor(gasType)) out[p.key] = '';
  return out;
}

/**
 * Soft range WARNs for gas quality + matrix params (never hard ERROR).
 * @returns {{ field: string, code: string, message: string, severity: 'WARN' }[]}
 */
export function validateGasPlantReading({ gasType, dewPointC, h2Pct, o2Ppm, gasParams = {} }) {
  const issues = [];
  const type = gasType === 'EXO' ? 'EXO' : 'N2-PSA';
  const quality = GAS_QUALITY_RANGES[type];

  function check(field, value, min, max, label) {
    if (value === '' || value == null) return;
    const n = Number(value);
    if (Number.isNaN(n)) return;
    if (n < min || n > max) {
      issues.push({
        field,
        code: 'GAS_RANGE',
        message: `${label} ${n} out of ${min}–${max}`,
        severity: 'WARN',
      });
    }
  }

  check('dewPointC', dewPointC, quality.dewPointC.min, quality.dewPointC.max, quality.dewPointC.label);
  check('h2Pct', h2Pct, quality.h2Pct.min, quality.h2Pct.max, quality.h2Pct.label);
  check('o2Ppm', o2Ppm, quality.o2Ppm.min, quality.o2Ppm.max, quality.o2Ppm.label);

  for (const p of gasParamDefsFor(type)) {
    check(`gasParams.${p.key}`, gasParams[p.key], p.min, p.max, p.label);
  }
  return issues;
}

/** Strip empty strings; coerce numeric strings to numbers for jsonb storage. */
export function normalizeGasParams(gasType, raw = {}) {
  const out = {};
  const keys = new Set(gasParamDefsFor(gasType).map((p) => p.key));
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (!keys.has(k)) continue;
    if (v === '' || v == null) continue;
    const n = Number(v);
    out[k] = Number.isNaN(n) ? v : n;
  }
  return out;
}
