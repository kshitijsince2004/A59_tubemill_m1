import { query, queryOne } from '../db/pool';
import { config } from '../config';

export async function listProcessStoppages(processCode, sourceId) {
  return query(
    `SELECT * FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND process_code = $2 AND source_id = $3
     ORDER BY from_time DESC`,
    [config.tenantId, processCode, sourceId]
  );
}

export async function openProcessStoppage(input)





{
  const open = await queryOne(
    `SELECT id FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND process_code = $2 AND source_id = $3 AND is_open = true`,
    [config.tenantId, input.processCode, input.sourceId]
  );
  if (open) throw new Error('Stoppage already open');

  return queryOne(
    `INSERT INTO txn.stoppage_entry (
       tenant_id, process_code, source_id, mill_code, from_time, is_open,
       stoppage_code, reason,
       category, is_planned,
       run_id
     ) VALUES (
       $1,$2,$3,$4, now(), true, $5, $6,
       (SELECT category FROM master.stoppage_code WHERE code = $5),
       COALESCE((SELECT is_planned FROM master.stoppage_code WHERE code = $5), false),
       CASE WHEN $2 = 'TM' THEN $3::uuid ELSE NULL END
     ) RETURNING *`,
    [
    config.tenantId,
    input.processCode,
    input.sourceId,
    input.millCode ?? input.processCode,
    input.stoppageCode,
    input.reason ?? null]

  );
}

export async function closeProcessStoppage(processCode, sourceId, client) {
  return queryOne(
    `UPDATE txn.stoppage_entry SET is_open = false, to_time = now()
     WHERE tenant_id = $1 AND process_code = $2 AND source_id = $3 AND is_open = true
     RETURNING *`,
    [config.tenantId, processCode, sourceId],
    client
  );
}

export async function listStoppageCodes(processPrefix) {
  if (!processPrefix) {
    return query(`SELECT * FROM master.stoppage_code WHERE tenant_id = $1 ORDER BY code`, [
    config.tenantId]
    );
  }
  return query(
    `SELECT * FROM master.stoppage_code
     WHERE tenant_id = $1 AND (code LIKE $2 OR code LIKE 'TM-%')
     ORDER BY code`,
    [config.tenantId, `${processPrefix}-%`]
  );
}