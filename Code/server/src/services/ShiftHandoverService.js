import { query, queryOne } from '../db/pool';
import { config } from '../config';

/**
 * @param {string} millCode
 * @param {string} shiftCode
 */
export async function openShift(millCode, shiftCode) {
  const open = await queryOne(
    `SELECT id FROM txn.tm_shift_log WHERE tenant_id = $1 AND mill_code = $2 AND closed_at IS NULL`,
    [config.tenantId, millCode],
  );
  if (open) return open;

  return queryOne(
    `INSERT INTO txn.tm_shift_log (tenant_id, mill_code, shift_code) VALUES ($1,$2,$3) RETURNING *`,
    [config.tenantId, millCode, shiftCode],
  );
}

/**
 * Carry open runs + open stoppages to a new shift log (H-1 analogue).
 * @param {string} millCode
 * @param {string} nextShiftCode
 */
export async function shiftBoundary(millCode, nextShiftCode) {
  const prev = await queryOne(
    `SELECT id FROM txn.tm_shift_log WHERE tenant_id = $1 AND mill_code = $2 AND closed_at IS NULL
     ORDER BY opened_at DESC LIMIT 1`,
    [config.tenantId, millCode]
  );

  const openRuns = await query(
    `SELECT id FROM txn.prod_tm_run
     WHERE tenant_id = $1 AND mill_code = $2
       AND run_state NOT IN ('RUN_COMPLETE','IDLE')
       AND status NOT IN ('LOCKED')`,
    [config.tenantId, millCode]
  );

  const openStoppages = await query(
    `SELECT s.id FROM txn.stoppage_entry s
     JOIN txn.prod_tm_run r ON r.id = s.run_id
     WHERE s.tenant_id = $1 AND r.mill_code = $2 AND s.is_open = true`,
    [config.tenantId, millCode]
  );

  const runIds = openRuns.map((r) => r.id);
  const stoppageIds = openStoppages.map((s) => s.id);

  if (prev) {
    await query(`UPDATE txn.tm_shift_log SET closed_at = now() WHERE id = $1`, [prev.id]);
  }

  const next = await queryOne(
    `INSERT INTO txn.tm_shift_log (
      tenant_id, mill_code, shift_code, carried_run_ids, carried_stoppage_ids, prev_shift_id
    ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [config.tenantId, millCode, nextShiftCode, runIds, stoppageIds, prev?.id ?? null]
  );

  for (const id of runIds) {
    await query(
      `UPDATE txn.prod_tm_run SET shift_close_ref = $2, shift_open_ref = $3 WHERE id = $1`,
      [id, prev?.id ?? null, next?.id]
    );
  }

  return {
    previousShiftId: prev?.id ?? null,
    nextShift: next,
    carriedRunIds: runIds,
    carriedStoppageIds: stoppageIds
  };
}

export async function listShifts(millCode) {
  return query(
    `SELECT * FROM txn.tm_shift_log WHERE tenant_id = $1 AND mill_code = $2 ORDER BY opened_at DESC LIMIT 20`,
    [config.tenantId, millCode]
  );
}