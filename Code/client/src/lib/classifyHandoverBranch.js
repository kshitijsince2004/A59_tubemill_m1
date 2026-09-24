/**
 * Which outgoing handover page to mount for A59 processes.
 * @typedef {'fur'|'stp'|'drw'|'tm'|'swg'|'fallback'} HandoverBranch
 */

/**
 * @param {string | null | undefined} machineCode
 * @param {string | null | undefined} processCode
 * @returns {HandoverBranch}
 */
export function classifyHandoverBranch(machineCode, processCode) {
  const code = String(processCode || machineCode || '')
    .trim()
    .toUpperCase();

  if (code === 'FUR' || code.startsWith('RHF')) return 'fur';
  if (code === 'STP' || code.startsWith('STP')) return 'stp';
  if (code === 'DRW' || code === 'DB' || code.startsWith('DB-') || code.startsWith('DRW')) return 'drw';
  if (code === 'TM' || code === 'A-59' || code.startsWith('A-')) return 'tm';
  if (code === 'SWG' || code.startsWith('SWG')) return 'swg';
  return 'fallback';
}
