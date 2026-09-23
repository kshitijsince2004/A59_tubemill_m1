import { query, queryOne } from '../db/pool';
import { config } from '../config';















export async function getQueue(millCode) {
  return query(
    `SELECT * FROM ops.queue_card WHERE tenant_id = $1 AND mill_code = $2 ORDER BY id`,
    [config.tenantId, millCode]
  );
}

export async function getQueueCard(id) {
  return queryOne(
    `SELECT * FROM ops.queue_card WHERE tenant_id = $1 AND id = $2`,
    [config.tenantId, id]
  );
}

export async function markQueueInProgress(cardId, runId) {
  await query(
    `UPDATE ops.queue_card SET status = 'In Progress', run_id = $3
     WHERE tenant_id = $1 AND id = $2`,
    [config.tenantId, cardId, runId]
  );
}

export async function markQueueHoldByRunId(runId) {
  await query(
    `UPDATE ops.queue_card SET status = 'Hold'
     WHERE tenant_id = $1 AND run_id = $2`,
    [config.tenantId, runId]
  );
}

export async function markQueueInProgressByRunId(runId) {
  await query(
    `UPDATE ops.queue_card SET status = 'In Progress'
     WHERE tenant_id = $1 AND run_id = $2`,
    [config.tenantId, runId]
  );
}

export async function markQueueCompletedByRunId(runId) {
  await query(
    `UPDATE ops.queue_card SET status = 'Completed'
     WHERE tenant_id = $1 AND run_id = $2`,
    [config.tenantId, runId]
  );
}

export function mapQueueCard(card) {
  return {
    id: card.id,
    millCode: card.mill_code,
    status: card.status,
    workOrderNo: card.work_order_no,
    bcBatchNumber: card.bc_batch_number,
    customerCode: card.customer_code,
    gradeCode: card.grade_code,
    sizeKey: card.size_key,
    size: card.size,
    qtyPieces: card.qty_pieces,
    runId: card.run_id
  };
}