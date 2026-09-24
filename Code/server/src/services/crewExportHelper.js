import { queryOne } from '../db/pool';
import { config } from '../config';
import { listByShiftLog, pickCrewFooterNames } from './CrewService';

/**
 * Resolve session crew for a machine on a given prod date + shift.
 * Used by DPR footers and MH review when shiftLogId is not on the entity.
 */
export async function resolveCrewForMachineShift(machineCode, prodDate, shiftCode) {
  if (!machineCode) return pickCrewFooterNames([]);
  try {
    const shiftLog = await queryOne(
      `SELECT id FROM txn.shift_log
       WHERE tenant_id = $1 AND machine_code = $2
         AND ($3::date IS NULL OR prod_date = $3::date)
         AND ($4::text IS NULL OR $4 = '' OR shift_code = $4)
       ORDER BY
         CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END,
         opened_at DESC
       LIMIT 1`,
      [
        config.tenantId,
        machineCode,
        prodDate ? String(prodDate).slice(0, 10) : null,
        shiftCode ? String(shiftCode) : null,
      ]
    );
    if (!shiftLog) return pickCrewFooterNames([]);
    const crew = await listByShiftLog(shiftLog.id);
    return {
      ...pickCrewFooterNames(crew),
      shiftLogId: shiftLog.id,
    };
  } catch {
    return pickCrewFooterNames([]);
  }
}

export async function resolveCrewByShiftLogId(shiftLogId) {
  if (!shiftLogId) return pickCrewFooterNames([]);
  try {
    const crew = await listByShiftLog(shiftLogId);
    return { ...pickCrewFooterNames(crew), shiftLogId };
  } catch {
    return pickCrewFooterNames([]);
  }
}
