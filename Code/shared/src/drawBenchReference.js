/**
 * Draw Bench reference: Table-A cadence, Table-B paint/swage, Table-C bench bands.
 * Source: Dev Specs/SHEET/Zedral_A59_DrawBench_M1_Data_Mapping.xlsx
 */

/** @typedef {'NEW_SIZE'|'4M'|'CUSTOMER_CONCERN'|'MASS'|'SHIFT_CHANGE'} SpecialControl */

/** Table-A: required inspection sample count per trigger (dimensional first/last-off). */
export const TABLE_A_CADENCE = {
  NEW_SIZE: { required: 3, firstOff: 2, lastOff: 1, label: 'New size / 1st production' },
  '4M': { required: 1, firstOff: 1, lastOff: 0, label: '4M / engineering change' },
  CUSTOMER_CONCERN: { required: 2, firstOff: 1, lastOff: 1, label: 'Customer concern / first 3 supply' },
  MASS: { required: 2, firstOff: 1, lastOff: 1, label: 'Mass production' },
  SHIFT_CHANGE: { required: 1, firstOff: 1, lastOff: 0, label: 'Shift change / power failure' },
};

/** Table-B paint colour by grade code (and special keys). */
export const TABLE_B_PAINT = {
  '1008': 'White',
  '1010': 'White',
  '1020': 'Yellow',
  '1026': 'Smoke grey',
  'ST52': 'Pink',
  'St 52': 'Pink',
  'BSK46': 'Brown',
  'BSK 46': 'Brown',
  CORTON: 'Blue',
  'SAE-1541': 'Light blue + white',
  'SPL-K3': 'Orange',
  'GRADE-50': 'Light pink + white',
  OPEN_JOINT: 'Red',
  REJECTED: 'Red',
};

/**
 * Table-C bench capability (finished OD confirm-gaps left null for DB-45/80/120 THK or OD).
 * Codes use T-suffix to match master.machine.
 */
export const TABLE_C_BENCHES = [
  {
    code: 'DB-10T',
    tonnage: 10,
    label: 'Draw Bench 10T',
    mhOd: [11, 38.1],
    mhThk: [0.89, 2.5],
    finOd: [6.5, 25.4],
    finThk: [0.7, 2.0],
  },
  {
    code: 'DB-20T',
    tonnage: 20,
    label: 'Draw Bench 20T',
    mhOd: [22.23, 44.45],
    mhThk: [1.4, 5.8],
    finOd: [12.7, 60.3],
    finThk: [0.8, 5.0],
  },
  {
    code: 'DB-40T',
    tonnage: 40,
    label: 'Draw Bench 40T',
    mhOd: [28.58, 88.9],
    mhThk: [2.0, 6.4],
    finOd: [38.1, 76.2],
    finThk: [1.0, 6.4],
  },
  {
    code: 'DB-45T',
    tonnage: 45,
    label: 'Draw Bench 45T (3 tube)',
    mhOd: [25.4, 50.8],
    mhThk: [2.0, 3.0],
    finOd: [null, null], // confirm scan
    finThk: [2.0, 3.6],
  },
  {
    code: 'DB-80T',
    tonnage: 80,
    label: 'Draw Bench 80T',
    mhOd: [38.1, 127],
    mhThk: [2.0, 7.5],
    finOd: [50.8, 114.3],
    finThk: [null, null], // confirm scan
  },
  {
    code: 'DB-120T',
    tonnage: 120,
    label: 'Draw Bench 120T',
    mhOd: [63.5, 114.3],
    mhThk: [7.5, 9.5],
    // workbook scan ambiguous — leave finished OD null until hard-copy confirm
    finOd: [null, null],
    finThk: [7.0, 9.0],
  },
  {
    code: 'DB-180T',
    tonnage: 180,
    label: 'Draw Bench 180T (LDP)',
    mhOd: [88.9, 168.3],
    mhThk: [4, 13],
    finOd: [63.5, 140],
    finThk: [3, 12.7],
  },
  {
    code: 'DB-250T',
    tonnage: 250,
    label: 'Draw Bench 250T (LDP)',
    mhOd: [88.9, 219.1],
    mhThk: [4, 15],
    finOd: [63.5, 212.0],
    finThk: [3, 14],
  },
];

/** Table-B min swage-end length by tonnage band. */
export const TABLE_B_SWAGE_END = [
  { tonnageMin: 10, tonnageMax: 20, lengthNomMm: 80, lengthTolMm: 10, label: 'DB-10T & DB-20T' },
  { tonnageMin: 40, tonnageMax: 80, lengthNomMm: 100, lengthTolMm: 10, label: 'DB-40T & DB-80T' },
  { tonnageMin: 120, tonnageMax: 120, lengthNomMm: 120, lengthTolMm: 10, label: 'DB-120T' },
  {
    tonnageMin: 180,
    tonnageMax: 250,
    lengthMinMm: 190,
    lengthMaxMm: 225,
    label: 'DB-180T & DB-250T (LDP)',
  },
];

export function paintColourForGrade(gradeCode) {
  if (!gradeCode) return null;
  const g = String(gradeCode).trim();
  return TABLE_B_PAINT[g] ?? TABLE_B_PAINT[g.toUpperCase()] ?? null;
}

/**
 * @param {SpecialControl|string|null|undefined} trigger
 * @param {{ inspection_type?: string, inspectionType?: string }[]} inspections
 */
export function tableAInspectionIssues(trigger, inspections = []) {
  const key = String(trigger || 'MASS');
  const cadence = TABLE_A_CADENCE[key] ?? TABLE_A_CADENCE.MASS;
  const rows = inspections ?? [];
  const first = rows.filter((r) => {
    const t = String(r.inspection_type ?? r.inspectionType ?? '').toUpperCase();
    return t === 'FIRST_OFF' || r.first_off_ok === true || r.firstOffOk === true;
  }).length;
  const last = rows.filter((r) => {
    const t = String(r.inspection_type ?? r.inspectionType ?? '').toUpperCase();
    return t === 'LAST_OFF' || r.last_off_ok === true || r.lastOffOk === true;
  }).length;
  const issues = [];
  if (rows.length < cadence.required) {
    issues.push({
      field: 'inspections',
      code: 'TABLE_A',
      message: `Table-A (${cadence.label}): need ${cadence.required} inspection sample(s), have ${rows.length}`,
      severity: 'ERROR',
    });
  }
  if (cadence.firstOff && first < cadence.firstOff) {
    issues.push({
      field: 'inspections',
      code: 'TABLE_A',
      message: `Table-A: need ${cadence.firstOff} first-off sample(s), have ${first}`,
      severity: 'ERROR',
    });
  }
  if (cadence.lastOff && last < cadence.lastOff) {
    issues.push({
      field: 'inspections',
      code: 'TABLE_A',
      message: `Table-A: need ${cadence.lastOff} last-off sample(s), have ${last}`,
      severity: 'ERROR',
    });
  }
  return issues;
}

export function dieConditionBlocksIssue(dieCondition, plugCondition) {
  const text = `${dieCondition ?? ''} ${plugCondition ?? ''}`.toLowerCase();
  return /crack|score|scratch/.test(text);
}
