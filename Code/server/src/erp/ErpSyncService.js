import { assertBcAdapterSupported, config } from '../config';

import { FileBcConnector } from './FileBcConnector';
import {
  upsertCodes,
  upsertCustomers,
  upsertGrades,
  upsertMachines,
  upsertOrders } from
'./mappers';
import { markWatermarkError, markWatermarkOk, markWatermarkRunning, listWatermarks } from './watermarks';
import { query } from '../db/pool';
import { ERP_ENTITIES } from './types';

export function getBcConnector() {
  assertBcAdapterSupported();
  if (config.bcAdapter === 'file') {
    return new FileBcConnector();
  }
  throw new Error(`BC_ADAPTER=${config.bcAdapter} is not implemented`);
}

async function syncOne(entity, millCode) {
  const connector = getBcConnector();
  await markWatermarkRunning(entity);
  try {
    const pulled = await connector.pull(entity);
    let upserted = 0;

    if (entity === 'machines') {
      upserted = await upsertMachines(pulled.rows);
    } else if (entity === 'customers') {
      upserted = await upsertCustomers(pulled.rows);
    } else if (entity === 'grades') {
      upserted = await upsertGrades(pulled.rows);
    } else if (entity === 'codes') {
      upserted = await upsertCodes(pulled.rows[0] ?? {});
    } else if (entity === 'orders') {
      const result = await upsertOrders(pulled.rows, millCode);
      upserted = result.ordersUpserted;
    }

    await markWatermarkOk(entity, upserted, pulled.fetchedAt);
    return { entity, pulled: pulled.rows.length, upserted, status: 'OK' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markWatermarkError(entity, message);
    return { entity, pulled: 0, upserted: 0, status: 'ERROR', error: message };
  }
}

export async function syncEntities(
entities,
millCode = 'A-59')
{
  const wanted = (entities?.length ? entities : ERP_ENTITIES).filter((e) =>
  ERP_ENTITIES.includes(e)
  );
  const results = [];
  for (const entity of wanted) {
    results.push(await syncOne(entity, millCode));
  }
  return { results };
}

/** Admin “Sync plan” path — orders only, returns queue upsert count. */
export async function syncOrders(millCode) {
  const summary = await syncOne('orders', millCode);
  if (summary.status === 'ERROR') {
    throw new Error(summary.error ?? 'Order sync failed');
  }
  return { upserted: summary.upserted };
}

export async function getErpHealth() {
  const wms = await listWatermarks();
  const counts = await query(
    `SELECT status, count(*)::text AS n FROM erp.writeback_job
     WHERE tenant_id = $1 GROUP BY status`,
    [config.tenantId]
  );
  const byStatus = {};
  for (const c of counts) byStatus[c.status] = Number(c.n);

  return {
    adapter: config.bcAdapter,
    watermarks: wms.map((w) => ({
      entity: w.entity,
      lastRunAt: w.last_run_at,
      status: w.status,
      rowCount: w.row_count,
      lastError: w.last_error
    })),
    outbox: {
      staged: byStatus.STAGED ?? 0,
      logged: byStatus.LOGGED ?? 0,
      failed: byStatus.FAILED ?? 0
    }
  };
}

export async function listReleasedOrders(status = 'Released') {
  return query(
    `SELECT work_order_no AS "workOrderNo", bc_id AS "bcId", status, mill_code AS "millCode",
            customer_code AS "customerCode", grade_code AS "gradeCode", lot_no AS "lotNo",
            size, qty_pieces AS "qtyPieces", planned_qty AS "plannedQty"
     FROM erp.released_order
     WHERE tenant_id = $1 AND status = $2
     ORDER BY work_order_no`,
    [config.tenantId, status]
  );
}