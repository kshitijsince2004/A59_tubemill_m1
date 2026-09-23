import { query } from '../db/pool';
import { config } from '../config';

/** Map BC-shaped seed rows into Zedral masters / queue / code_map. */

export async function upsertMachines(rows) {
  let n = 0;
  for (const r of rows) {
    const code = String(r.machineCode ?? '');
    if (!code) continue;
    await query(
      `INSERT INTO master.machine (machine_code, tenant_id, label, process_code, saw_type, bc_id, source)
       VALUES ($1,$2,$3,$4,$5,$6,'API')
       ON CONFLICT (machine_code) DO UPDATE SET
         label = COALESCE(EXCLUDED.label, master.machine.label),
         process_code = COALESCE(EXCLUDED.process_code, master.machine.process_code),
         saw_type = COALESCE(EXCLUDED.saw_type, master.machine.saw_type),
         bc_id = EXCLUDED.bc_id,
         source = 'API'
       WHERE master.machine.tenant_id = EXCLUDED.tenant_id`,
      [
      code,
      config.tenantId,
      r.label ?? code,
      r.processCode ?? null,
      r.sawType ?? null,
      r.bcId ?? null]

    );
    n += 1;
  }
  return n;
}

export async function upsertCustomers(rows) {
  let n = 0;
  for (const r of rows) {
    const code = String(r.code ?? '');
    if (!code) continue;
    await query(
      `INSERT INTO master.customer (code, tenant_id, name, bc_id, source)
       VALUES ($1,$2,$3,$4,'API')
       ON CONFLICT (code) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, master.customer.name),
         bc_id = EXCLUDED.bc_id,
         source = 'API'
       WHERE master.customer.tenant_id = EXCLUDED.tenant_id`,
      [code, config.tenantId, r.name ?? code, r.bcId ?? null]
    );
    n += 1;
  }
  return n;
}

export async function upsertGrades(rows) {
  let n = 0;
  for (const r of rows) {
    const code = String(r.code ?? '');
    if (!code) continue;
    await query(
      `INSERT INTO master.grade (code, tenant_id, label, density_kg_m3, bc_id, source)
       VALUES ($1,$2,$3,$4,$5,'API')
       ON CONFLICT (code) DO UPDATE SET
         label = COALESCE(EXCLUDED.label, master.grade.label),
         density_kg_m3 = COALESCE(EXCLUDED.density_kg_m3, master.grade.density_kg_m3),
         bc_id = EXCLUDED.bc_id,
         source = 'API'
       WHERE master.grade.tenant_id = EXCLUDED.tenant_id`,
      [code, config.tenantId, r.label ?? code, r.densityKgM3 ?? 7850, r.bcId ?? null]
    );
    n += 1;
  }
  return n;
}

export async function upsertCodes(payload) {
  let n = 0;
  const stoppage = payload.stoppage ?? [];
  const scrap = payload.scrap ?? [];

  for (const r of stoppage) {
    const zedral = String(r.zedralCode ?? '');
    const bc = String(r.bcCode ?? '');
    if (!zedral || !bc) continue;
    await query(
      `INSERT INTO master.stoppage_code (code, tenant_id, label, category, is_planned, bc_id, source)
       VALUES ($1,$2,$3,$4,$5,$6,'API')
       ON CONFLICT (code) DO UPDATE SET
         label = COALESCE(EXCLUDED.label, master.stoppage_code.label),
         category = COALESCE(EXCLUDED.category, master.stoppage_code.category),
         is_planned = COALESCE(EXCLUDED.is_planned, master.stoppage_code.is_planned),
         bc_id = EXCLUDED.bc_id,
         source = 'API'
       WHERE master.stoppage_code.tenant_id = EXCLUDED.tenant_id`,
      [
      zedral,
      config.tenantId,
      r.label ?? zedral,
      r.category ?? 'OTHER',
      r.isPlanned === true,
      bc]

    );
    await query(
      `INSERT INTO erp.code_map (tenant_id, kind, zedral_code, bc_code)
       VALUES ($1,'STOPPAGE',$2,$3)
       ON CONFLICT (tenant_id, kind, zedral_code) DO UPDATE SET bc_code = EXCLUDED.bc_code`,
      [config.tenantId, zedral, bc]
    );
    n += 1;
  }

  for (const r of scrap) {
    const zedral = String(r.zedralCode ?? '');
    const bc = String(r.bcCode ?? '');
    if (!zedral || !bc) continue;
    await query(
      `INSERT INTO erp.code_map (tenant_id, kind, zedral_code, bc_code)
       VALUES ($1,'SCRAP',$2,$3)
       ON CONFLICT (tenant_id, kind, zedral_code) DO UPDATE SET bc_code = EXCLUDED.bc_code`,
      [config.tenantId, zedral, bc]
    );
    n += 1;
  }
  return n;
}

export async function upsertOrders(
rows,
millCodeFilter)
{
  let queueUpserted = 0;
  let ordersUpserted = 0;

  for (const r of rows) {
    const status = String(r.status ?? '');
    if (status !== 'Released') continue;

    const millCode = String(r.millCode ?? 'A-59');
    if (millCodeFilter && millCode !== millCodeFilter) continue;

    const workOrderNo = String(r.workOrderNo ?? '');
    if (!workOrderNo) continue;

    await query(
      `INSERT INTO erp.released_order (
        tenant_id, bc_id, work_order_no, status, mill_code, customer_code, grade_code,
        lot_no, size, qty_pieces, planned_qty, source, payload, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'API',$12, now())
      ON CONFLICT (tenant_id, work_order_no) DO UPDATE SET
        bc_id = EXCLUDED.bc_id,
        status = EXCLUDED.status,
        mill_code = EXCLUDED.mill_code,
        customer_code = EXCLUDED.customer_code,
        grade_code = EXCLUDED.grade_code,
        lot_no = EXCLUDED.lot_no,
        size = EXCLUDED.size,
        qty_pieces = EXCLUDED.qty_pieces,
        planned_qty = EXCLUDED.planned_qty,
        source = 'API',
        payload = EXCLUDED.payload,
        updated_at = now()`,
      [
      config.tenantId,
      r.bcId ?? workOrderNo,
      workOrderNo,
      status,
      millCode,
      r.customerCode ?? null,
      r.gradeCode ?? null,
      r.lotNo ?? null,
      JSON.stringify(r.size ?? {}),
      r.qtyPieces ?? null,
      r.plannedQty ?? null,
      JSON.stringify(r)]

    );
    ordersUpserted += 1;

    const cardId = String(r.queueCardId ?? `erp-${workOrderNo}`);
    const sizeKey = String(r.sizeKey ?? workOrderNo);
    await query(
      `INSERT INTO ops.queue_card (
        id, tenant_id, mill_code, status, work_order_no, bc_batch_number,
        customer_code, grade_code, size_key, size, qty_pieces, bc_id, source, lot_no
      ) VALUES ($1,$2,$3,'Pending',$4,$5,$6,$7,$8,$9,$10,$11,'API',$12)
      ON CONFLICT (id) DO UPDATE SET
        work_order_no = EXCLUDED.work_order_no,
        bc_batch_number = EXCLUDED.bc_batch_number,
        customer_code = EXCLUDED.customer_code,
        grade_code = EXCLUDED.grade_code,
        size_key = EXCLUDED.size_key,
        size = EXCLUDED.size,
        qty_pieces = EXCLUDED.qty_pieces,
        bc_id = EXCLUDED.bc_id,
        source = 'API',
        lot_no = EXCLUDED.lot_no
      WHERE ops.queue_card.status = 'Pending'`,
      [
      cardId,
      config.tenantId,
      millCode,
      workOrderNo,
      r.bcBatchNumber ?? null,
      r.customerCode ?? null,
      r.gradeCode ?? null,
      sizeKey,
      JSON.stringify(r.size ?? {}),
      r.qtyPieces ?? null,
      r.bcId ?? null,
      r.lotNo ?? null]

    );
    queueUpserted += 1;

    const lines = Array.isArray(r.lines) && r.lines.length
      ? r.lines
      : [
          {
            lineNo: 1,
            lotNo: r.lotNo,
            coilNo: r.lotNo,
            size: r.size,
            qtyPieces: r.qtyPieces,
            plannedQty: r.plannedQty,
            tubeShape: r.size?.profile ?? 'ROUND',
          },
        ];

    for (const line of lines) {
      await query(
        `INSERT INTO erp.released_order_line (
           tenant_id, work_order_no, line_no, customer_code, grade_code, lot_no, coil_no, tdc, pass_no,
           size, qty_pieces, planned_qty, final_size, tube_shape, next_process, remarks, payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (tenant_id, work_order_no, line_no) DO UPDATE SET
           customer_code = EXCLUDED.customer_code,
           grade_code = EXCLUDED.grade_code,
           lot_no = EXCLUDED.lot_no,
           coil_no = EXCLUDED.coil_no,
           tdc = EXCLUDED.tdc,
           pass_no = EXCLUDED.pass_no,
           size = EXCLUDED.size,
           qty_pieces = EXCLUDED.qty_pieces,
           planned_qty = EXCLUDED.planned_qty,
           final_size = EXCLUDED.final_size,
           tube_shape = EXCLUDED.tube_shape,
           next_process = EXCLUDED.next_process,
           remarks = EXCLUDED.remarks,
           payload = EXCLUDED.payload,
           updated_at = now()`,
        [
          config.tenantId,
          workOrderNo,
          line.lineNo ?? 1,
          r.customerCode ?? null,
          r.gradeCode ?? null,
          line.lotNo ?? r.lotNo ?? null,
          line.coilNo ?? line.lotNo ?? r.lotNo ?? null,
          line.tdc ?? null,
          line.passNo ?? null,
          JSON.stringify(line.size ?? r.size ?? {}),
          line.qtyPieces ?? r.qtyPieces ?? null,
          line.plannedQty ?? r.plannedQty ?? null,
          JSON.stringify(line.finalSize ?? {}),
          line.tubeShape ?? r.size?.profile ?? null,
          line.nextProcess ?? null,
          line.remarks ?? null,
          JSON.stringify(line),
        ]
      );
    }
  }

  return { queueUpserted, ordersUpserted };
}