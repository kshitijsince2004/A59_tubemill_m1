/**
 * Handover ACL: resolve machine → process_code; require process WRITE or machine WRITE.
 */

import { queryOne } from '../db/pool';
import { config } from '../config';
import {
  userHasProcessAccess,
  userHasMachineAccess,
} from '../middleware/authMiddleware';
import { accessibleMachineCodes } from '../auth/machineAccessPolicy';

/** Infer process when master.machine row is missing (bad client codes). */
export function inferProcessCode(machineCode) {
  const code = String(machineCode ?? '').trim().toUpperCase();
  if (!code) return null;
  if (code === 'TM' || code === 'A-59' || /^A-\d/.test(code)) return 'TM';
  if (code === 'FUR' || code.startsWith('RHF')) return 'FUR';
  if (code === 'STP' || code.startsWith('STP')) return 'STP';
  if (code === 'DRW' || code === 'DB' || code.startsWith('DB-') || code.startsWith('DRW')) {
    return 'DRW';
  }
  if (code === 'SWG' || code.startsWith('SWG')) return 'SWG';
  return null;
}

/**
 * @param {{ roles?: string[], processAccess?: any[], machineAccess?: any[] }} user
 * @param {string} machineCode
 */
export async function assertHandoverMachineAccess(user, machineCode) {
  if (!user) {
    const err = new Error('Unauthenticated');
    err.status = 401;
    throw err;
  }
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PLANT_HEAD')) return;

  const code = String(machineCode ?? '').trim();
  if (!code) {
    const err = new Error('machineCode required');
    err.status = 400;
    throw err;
  }

  const machine = await queryOne(
    `SELECT process_code FROM master.machine
     WHERE machine_code = $1 AND tenant_id = $2`,
    [code, config.tenantId]
  );
  const processCode = machine?.process_code || inferProcessCode(code);

  const processOk = processCode
    ? userHasProcessAccess(user, processCode, 'WRITE')
    : false;
  const machineOk = userHasMachineAccess(user, code, 'WRITE');

  if (!processOk && !machineOk) {
    const err = new Error(
      `Requires WRITE on process ${processCode || code} or machine ${code}`
    );
    err.status = 403;
    throw err;
  }
}

/**
 * Machine filter for overview: null = all (PLANT_HEAD/ADMIN), else machine codes.
 * @param {{ roles?: string[], machineAccess?: { machineCode: string }[] }} user
 * @returns {string[] | null}
 */
export function handoverOverviewMachineFilter(user) {
  if (!user) return [];
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PLANT_HEAD')) {
    return null;
  }
  const codes = accessibleMachineCodes(user);
  if (codes == null) return null;
  return codes;
}
