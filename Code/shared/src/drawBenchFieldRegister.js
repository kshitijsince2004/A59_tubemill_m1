/**
 * Field Register from Zedral_A59_DrawBench_M1_Data_Mapping.xlsx.
 * Capture class drives UI source badges. AUTO fields stay operator-enterable
 * until PLC tag maps exist (workbook D-6).
 */

/** @typedef {'AUTO'|'DERIVED'|'MANUAL'|'MASTER'|'SYSTEM'} FieldClass */

/**
 * @type {Record<string, { id: string, label: string, class: FieldClass, unit?: string, note?: string }>}
 */
export const DRAW_BENCH_FIELD_REGISTER = {
  lotNo: { id: 'DB-01', label: 'Lot / run id', class: 'SYSTEM' },
  workOrderNo: { id: 'DB-02', label: 'W.O. No', class: 'DERIVED' },
  customerCode: { id: 'DB-03', label: 'Customer', class: 'DERIVED' },
  gradeCode: { id: 'DB-04', label: 'Grade', class: 'DERIVED' },
  size: { id: 'DB-05', label: 'Tube size ordered', class: 'DERIVED', unit: 'mm' },
  benchCode: { id: 'DB-06', label: 'Draw bench No', class: 'DERIVED' },
  drawPass: { id: 'DB-07', label: 'Draw pass', class: 'MANUAL' },
  inputTubeRef: { id: 'DB-08', label: 'Incoming tube ref', class: 'DERIVED' },
  shiftRef: { id: 'DB-09', label: 'Shift', class: 'DERIVED' },
  prodDate: { id: 'DB-09', label: 'Date', class: 'DERIVED' },
  paintColour: { id: 'DB-04', label: 'Paint colour', class: 'DERIVED', note: 'Table-B' },
  operatorRef: { id: 'PR-02', label: 'Operator name', class: 'MANUAL' },
  finalOd: { id: 'PR-04', label: 'Final OD', class: 'DERIVED', unit: 'mm' },
  finalId: { id: 'PR-04', label: 'Final ID', class: 'DERIVED', unit: 'mm' },
  finalThk: { id: 'PR-04', label: 'Final THK', class: 'DERIVED', unit: 'mm' },
  finalLen: { id: 'PR-04', label: 'Final LEN', class: 'DERIVED', unit: 'mm' },
  fromOd: { id: 'PR-05', label: 'FROM OD', class: 'MANUAL', unit: 'mm' },
  fromId: { id: 'PR-05', label: 'FROM ID', class: 'MANUAL', unit: 'mm' },
  fromThk: { id: 'PR-05', label: 'FROM THK', class: 'MANUAL', unit: 'mm' },
  fromLen: { id: 'PR-05', label: 'FROM LEN', class: 'MANUAL', unit: 'mm' },
  toOd: { id: 'PR-06', label: 'TO OD', class: 'MANUAL', unit: 'mm' },
  toId: { id: 'PR-06', label: 'TO ID', class: 'MANUAL', unit: 'mm' },
  toThk: { id: 'PR-06', label: 'TO THK', class: 'MANUAL', unit: 'mm' },
  toLen: { id: 'PR-06', label: 'TO LEN', class: 'MANUAL', unit: 'mm' },
  drawPlanLenMm: { id: 'PR-07', label: 'Draw plan length', class: 'DERIVED', unit: 'mm' },
  stage: { id: 'PR-08', label: 'Inter / Final', class: 'MANUAL' },
  acceptedPcs: { id: 'PR-09', label: 'Accepted Nos', class: 'MANUAL', unit: 'pcs', note: 'AUTO if bench PLC' },
  acceptedMt: { id: 'PR-09', label: 'Accepted MT', class: 'MANUAL', unit: 'MT' },
  rejectedPcs: { id: 'PR-10', label: 'Rejected Nos', class: 'MANUAL', unit: 'pcs' },
  drawnMetre: { id: 'PR-11', label: 'Drawn meter', class: 'AUTO', unit: 'm', note: 'PLC pending' },
  pullLoadT: { id: 'PR-12', label: 'Pulling load', class: 'AUTO', unit: 't', note: 'PLC pending' },
  cycleTimeS: { id: 'PR-13', label: 'Cycle time', class: 'AUTO', unit: 's', note: 'PLC pending' },
  breakdownRemark: { id: 'PR-14', label: 'Break down / remarks', class: 'MANUAL' },
  tagNo: { id: 'PR-19', label: 'Tag', class: 'MANUAL' },
  inputNos: { id: 'PR-09', label: 'Input / planned Nos', class: 'DERIVED', unit: 'pcs' },
  remarks: { id: 'PR-14', label: 'Remarks', class: 'MANUAL' },
  supervisorRef: { id: 'PR-FOOT', label: 'Supervisor', class: 'MANUAL', note: 'DB-FT-01 footer' },
  shiftInchargeRef: { id: 'PR-FOOT', label: 'Shift Incharge', class: 'MANUAL', note: 'DB-FT-01 footer' },
  drawSpeedSet: { id: 'MC-06', label: 'Draw speed setting', class: 'MASTER' },
};

/**
 * @param {FieldClass | string} cls
 * @returns {string}
 */
export function fieldSourceLabel(cls) {
  switch (cls) {
    case 'AUTO':
      return 'AUTO · PLC pending';
    case 'DERIVED':
      return 'ERP';
    case 'MANUAL':
      return 'Manual';
    case 'MASTER':
      return 'Master';
    case 'SYSTEM':
      return 'System';
    default:
      return String(cls ?? '');
  }
}
