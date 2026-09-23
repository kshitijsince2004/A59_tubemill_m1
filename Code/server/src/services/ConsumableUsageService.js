import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { getRun } from './RunService';

export async function listConsumables() {
  return query(`SELECT * FROM master.tm_consumable WHERE tenant_id = $1 ORDER BY kind, code`, [
  config.tenantId]
  );
}

export async function getConsumable(code) {
  return queryOne(`SELECT * FROM master.tm_consumable WHERE tenant_id = $1 AND code = $2`, [
  config.tenantId,
  code]
  );
}

export function isChangeDue(row)




{
  const mt = Number(row.cumulative_tonnage_mt ?? 0);
  const thrMt = row.replace_threshold_mt != null ? Number(row.replace_threshold_mt) : null;
  const uses = Number(row.cumulative_uses ?? 0);
  const thrUses = row.replace_threshold_uses != null ? Number(row.replace_threshold_uses) : null;
  if (thrMt != null && mt >= thrMt) return true;
  if (thrUses != null && uses >= thrUses) return true;
  return false;
}

/** Add accepted MT from a run to the work-coil (and bump uses). DRAFT-only to avoid double-apply. */
export async function applyRunUsage(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error('Run not found');
  if (run.status !== 'DRAFT') throw new Error('Consumable usage can only be applied on DRAFT submit');

  const setup = await queryOne(
    `SELECT work_coil_id FROM txn.tm_setup WHERE run_id = $1`,
    [runId]
  );
  const code = setup?.work_coil_id ?? run.tooling?.workCoilId;
  if (!code || typeof code !== 'string') return { changeDue: false, code: null };

  const accepted =
  run.totalPrimeMt + run.totalPq2Mt + run.totalCqMt + run.totalOpenMt;

  const updated = await queryOne(





    `UPDATE master.tm_consumable SET
      cumulative_tonnage_mt = COALESCE(cumulative_tonnage_mt, 0) + $2,
      cumulative_uses = COALESCE(cumulative_uses, 0) + 1,
      status = CASE
        WHEN COALESCE(replace_threshold_mt, 999999) <= COALESCE(cumulative_tonnage_mt, 0) + $2 THEN 'CHANGE_DUE'
        WHEN COALESCE(replace_threshold_uses, 999999) <= COALESCE(cumulative_uses, 0) + 1 THEN 'CHANGE_DUE'
        ELSE status
      END
     WHERE tenant_id = $3 AND code = $1
     RETURNING cumulative_tonnage_mt, cumulative_uses, replace_threshold_mt, replace_threshold_uses`,
    [code, accepted, config.tenantId]
  );

  if (updated) {
    await query(
      `INSERT INTO txn.tm_consumable_usage (
        tenant_id, consumable_code, run_id, cumulative_tonnage_mt, cumulative_uses, delta_tonnage_mt, action
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
      config.tenantId,
      code,
      runId,
      Number(updated.cumulative_tonnage_mt),
      Number(updated.cumulative_uses),
      accepted,
      isChangeDue(updated) ? 'CHANGE_DUE' : 'USAGE']

    );
  }

  return { changeDue: updated ? isChangeDue(updated) : false, code };
}

export async function recordInspection(
code,
visualInspection,
action,
runId)
{
  const row = await getConsumable(code);
  if (!row) throw new Error('Consumable not found');
  await query(
    `INSERT INTO txn.tm_consumable_usage (
      tenant_id, consumable_code, run_id, cumulative_tonnage_mt, cumulative_uses, visual_inspection, action
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
    config.tenantId,
    code,
    runId ?? null,
    Number(row.cumulative_tonnage_mt ?? 0),
    Number(row.cumulative_uses ?? 0),
    visualInspection,
    action]

  );
  return getConsumable(code);
}

export async function getUsageHistory(code) {
  return query(
    `SELECT * FROM txn.tm_consumable_usage WHERE tenant_id = $1 AND consumable_code = $2 ORDER BY at DESC LIMIT 50`,
    [config.tenantId, code]
  );
}