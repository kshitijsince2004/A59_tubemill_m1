/**
 * Reparent open work from outgoing → incoming shift_log (accept + auto boundary).
 * A59 process map: TM / FUR / STP / DRW.
 */

import { config } from '../../config';

/**
 * @param {import('pg').PoolClient} client
 * @param {{
 *   machineCode: string,
 *   processCode: string,
 *   outgoingShiftLogId: string | null,
 *   incomingShiftLogId: string,
 * }} args
 */
export async function reparentOpenWork(client, args) {
  const { machineCode, processCode, outgoingShiftLogId, incomingShiftLogId } = args;
  if (!outgoingShiftLogId || !incomingShiftLogId || outgoingShiftLogId === incomingShiftLogId) {
    return;
  }
  const tenantId = config.tenantId;
  const code = String(processCode || '').toUpperCase();

  await client.query(
    `UPDATE txn.stoppage_entry
     SET shift_log_id = $1
     WHERE tenant_id = $2
       AND shift_log_id = $3
       AND is_open = true`,
    [incomingShiftLogId, tenantId, outgoingShiftLogId]
  );

  if (code === 'TM') {
    await client.query(
      `UPDATE txn.prod_tm_run
       SET shift_log_id = $1
       WHERE tenant_id = $2
         AND mill_code = $3
         AND shift_log_id = $4
         AND run_state NOT IN ('RUN_COMPLETE', 'IDLE')
         AND status NOT IN ('LOCKED', 'APPROVED')`,
      [incomingShiftLogId, tenantId, machineCode, outgoingShiftLogId]
    );
    return;
  }

  if (code === 'FUR') {
    await client.query(
      `UPDATE txn.prod_ann_run
       SET shift_log_id = $1
       WHERE tenant_id = $2
         AND furnace_code = $3
         AND shift_log_id = $4
         AND status IN ('DRAFT', 'OPEN', 'IN_PROGRESS', 'SUBMITTED')`,
      [incomingShiftLogId, tenantId, machineCode, outgoingShiftLogId]
    );
    return;
  }

  if (code === 'STP') {
    await client.query(
      `UPDATE txn.prod_stp_lot
       SET shift_log_id = $1
       WHERE tenant_id = $2
         AND machine_code = $3
         AND shift_log_id = $4
         AND status IN ('DRAFT', 'OPEN', 'IN_PROGRESS', 'SUBMITTED')`,
      [incomingShiftLogId, tenantId, machineCode, outgoingShiftLogId]
    );
    return;
  }

  if (code === 'DRW') {
    await client.query(
      `UPDATE txn.prod_db_lot
       SET shift_log_id = $1
       WHERE tenant_id = $2
         AND bench_code = $3
         AND shift_log_id = $4
         AND status IN ('DRAFT', 'HOLD', 'OPEN', 'IN_PROGRESS', 'SUBMITTED')`,
      [incomingShiftLogId, tenantId, machineCode, outgoingShiftLogId]
    );
  }
}
