/**
 * Canonical floor machine codes — must match master.machine (see seed).
 * Process aliases (TM/DRW/RHF) are not session/handover identities.
 */
export const CANONICAL_MACHINE = {
  TM: 'A-59',
  FUR: 'RHF-03',
  STP: 'STP-LINE',
  DRW: 'DB-10T',
  SWG: 'SWG-01',
};

const PROCESS_ALIASES = new Set(['TM', 'FUR', 'STP', 'DRW', 'SWG', 'DB', 'RHF']);

/**
 * True when code is concrete enough to open a machine_shift_session / handover.
 */
export function isConcreteMachineCode(machineCode) {
  const code = String(machineCode ?? '').trim().toUpperCase();
  if (!code || PROCESS_ALIASES.has(code)) return false;
  // Bare family prefixes without an instance id
  if (/^(A|RHF|STP|DB|DRW|SWG)$/.test(code)) return false;
  return true;
}

export function canonicalMachineForProcess(processId) {
  const id = String(processId ?? '').trim().toUpperCase();
  return CANONICAL_MACHINE[id] ?? null;
}
