/**
 * Helpers for capture paths: pending-handover gate + shift_log stamp.
 */

import { getActiveSession } from '../MachineSessionService';
import { assertProductionAllowed } from '../MachineHandoverService';

/**
 * @param {string} machineCode
 * @param {{ userId?: string } | null | undefined} user
 */
export async function guardProductionWrite(machineCode, user) {
  if (!machineCode || !user?.userId) return;
  await assertProductionAllowed(machineCode, user.userId);
}

/**
 * @param {string} machineCode
 * @returns {Promise<string | null>}
 */
export async function activeShiftLogId(machineCode) {
  if (!machineCode) return null;
  try {
    const session = await getActiveSession(machineCode);
    return session?.shiftLogId ?? null;
  } catch {
    return null;
  }
}
