import { query } from '../db/pool';
import { assertBcAdapterSupported } from '../config';
import { syncOrders } from '../erp/ErpSyncService';
import { enqueueTmWriteback } from '../erp/ErpWritebackService';






















/**
 * Thin wrapper: Admin “Sync plan” lands through erp.* via ErpSyncService.
 * Live Dynamics OData will implement the same BcConnector surface.
 */
export class FileBcPlanAdapter {
  async pullWorkOrders(millCode) {
    const result = await syncOrders(millCode);
    const rows = await query(
      `SELECT id, mill_code, status, work_order_no, bc_batch_number, customer_code, grade_code,
              size_key, size, qty_pieces
       FROM ops.queue_card
       WHERE mill_code = $1 AND status = 'Pending'
       ORDER BY work_order_no
       LIMIT $2`,
      [millCode, Math.max(result.upserted, 50)]
    );
    return rows.map((r) => ({
      id: String(r.id),
      millCode: String(r.mill_code),
      status: String(r.status),
      workOrderNo: String(r.work_order_no),
      bcBatchNumber: String(r.bc_batch_number ?? ''),
      customerCode: String(r.customer_code ?? ''),
      gradeCode: String(r.grade_code ?? ''),
      sizeKey: String(r.size_key),
      size: r.size ?? {},
      qtyPieces: r.qty_pieces != null ? Number(r.qty_pieces) : undefined
    }));
  }
}

export class FileBcWritebackAdapter {
  async writeActuals(runId) {
    const staged = await enqueueTmWriteback(runId);
    return {
      ok: true,
      payload: { staged: staged.staged, status: 'STAGED' }
    };
  }
}

function getPlanAdapter() {
  assertBcAdapterSupported();
  return new FileBcPlanAdapter();
}

function getWritebackAdapter() {
  assertBcAdapterSupported();
  return new FileBcWritebackAdapter();
}

export async function pullWorkOrders(millCode) {
  return getPlanAdapter().pullWorkOrders(millCode);
}

export async function syncPlanToQueue(millCode) {
  return syncOrders(millCode);
}

export async function writeActuals(runId) {
  return getWritebackAdapter().writeActuals(runId);
}