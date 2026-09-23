import { query } from '../db/pool';
import { config } from '../config';


export async function getWatermark(entity) {
  return query(






    `SELECT entity, last_cursor, last_run_at, status, row_count, last_error
      FROM erp.sync_watermark WHERE tenant_id = $1 AND entity = $2`, [config.tenantId, entity]).then(
    (rows) => rows[0] ?? null
  );
}

export async function listWatermarks() {
  return query(







    `SELECT entity, last_cursor, last_run_at, status, row_count, last_error
     FROM erp.sync_watermark WHERE tenant_id = $1 ORDER BY entity`,
    [config.tenantId]
  );
}

export async function markWatermarkRunning(entity) {
  await query(
    `INSERT INTO erp.sync_watermark (entity, tenant_id, status, updated_at)
     VALUES ($1, $2, 'RUNNING', now())
     ON CONFLICT (entity) DO UPDATE SET status = 'RUNNING', last_error = NULL, updated_at = now()`,
    [entity, config.tenantId]
  );
}

export async function markWatermarkOk(entity, rowCount, cursor) {
  await query(
    `INSERT INTO erp.sync_watermark (entity, tenant_id, last_cursor, last_run_at, status, row_count, last_error, updated_at)
     VALUES ($1, $2, $3, now(), 'OK', $4, NULL, now())
     ON CONFLICT (entity) DO UPDATE SET
       last_cursor = EXCLUDED.last_cursor,
       last_run_at = now(),
       status = 'OK',
       row_count = EXCLUDED.row_count,
       last_error = NULL,
       updated_at = now()`,
    [entity, config.tenantId, cursor ?? new Date().toISOString(), rowCount]
  );
}

export async function markWatermarkError(entity, error) {
  await query(
    `INSERT INTO erp.sync_watermark (entity, tenant_id, status, last_error, updated_at)
     VALUES ($1, $2, 'ERROR', $3, now())
     ON CONFLICT (entity) DO UPDATE SET status = 'ERROR', last_error = EXCLUDED.last_error, updated_at = now()`,
    [entity, config.tenantId, error]
  );
}