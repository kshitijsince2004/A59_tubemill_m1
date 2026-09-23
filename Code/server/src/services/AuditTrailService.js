import { query } from '../db/pool';
import { config } from '../config';

/**
 * @param {{
 *   actorUserId?: string | null,
 *   actorUsername?: string | null,
 *   action: string,
 *   entityType: string,
 *   entityId?: string | null,
 *   detail?: object,
 * }} input
 */
export async function recordAuditEvent(input) {
  try {
    await query(
      `INSERT INTO txn.audit_event (
         tenant_id, actor_user_id, actor_username, action, entity_type, entity_id, detail
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        config.tenantId,
        input.actorUserId ?? null,
        input.actorUsername ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.detail ?? {}),
      ]
    );
  } catch {
    /* table may not exist yet — non-fatal */
  }
}

export async function listAuditEvents({ limit = 100, entityType, action } = {}) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const params = [config.tenantId];
  let sql = `SELECT id, at, actor_user_id, actor_username, action, entity_type, entity_id, detail
             FROM txn.audit_event WHERE tenant_id = $1`;
  if (entityType) {
    params.push(entityType);
    sql += ` AND entity_type = $${params.length}`;
  }
  if (action) {
    params.push(action);
    sql += ` AND action = $${params.length}`;
  }
  params.push(lim);
  sql += ` ORDER BY at DESC LIMIT $${params.length}`;

  try {
    const rows = await query(sql, params);
    return rows.map((r) => ({
      id: String(r.id),
      at: r.at,
      actorUserId: r.actor_user_id,
      actorUsername: r.actor_username,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      detail: r.detail,
    }));
  } catch {
    return [];
  }
}
