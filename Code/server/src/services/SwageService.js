import { query, queryOne } from '../db/pool';
import { config } from '../config';


function mapSwage(row) {
  return {
    id: row.id,
    lotNo: row.lot_no,
    linkedDbLotId: row.linked_db_lot_id,
    swgMachine: row.swg_machine,
    workOrderNo: row.work_order_no,
    customerCode: row.customer_code,
    gradeCode: row.grade_code,
    size: row.size,
    swgDie: row.swg_die,
    drawSize: row.draw_size,
    tagLenMm: row.tag_len_mm != null ? Number(row.tag_len_mm) : null,
    lenAfterDieMm: row.len_after_die_mm != null ? Number(row.len_after_die_mm) : null,
    pieces: row.pieces != null ? Number(row.pieces) : null,
    tagNo: row.tag_no,
    shiftRef: row.shift_ref,
    prodDate: row.prod_date,
    status: row.status,
    dataSource: row.data_source,
    remarks: row.remarks,
    materialLotId: row.material_lot_id,
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

export async function listSwageLots(filter = {}) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filter.status) {
    clauses.push(`status = $${i++}`);
    params.push(filter.status);
  }
  if (filter.workOrderNo) {
    clauses.push(`work_order_no ILIKE $${i++}`);
    params.push(`%${filter.workOrderNo}%`);
  }
  const rows = await query(
    `SELECT * FROM txn.prod_db_swage WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return rows.map(mapSwage);
}

export async function getSwageLot(id) {
  const row = await queryOne(`SELECT * FROM txn.prod_db_swage WHERE id = $1 AND tenant_id = $2`, [
  id,
  config.tenantId]
  );
  return row ? mapSwage(row) : null;
}

export async function createSwageLot(input) {
  const row = await queryOne(
    `INSERT INTO txn.prod_db_swage (
      tenant_id, lot_no, linked_db_lot_id, swg_machine, work_order_no, customer_code, grade_code,
      size, swg_die, draw_size, tag_len_mm, len_after_die_mm, pieces, tag_no, shift_ref, prod_date,
      status, data_source, remarks, created_by, material_lot_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    RETURNING *`,
    [
    config.tenantId,
    input.lotNo,
    input.linkedDbLotId ?? null,
    input.swgMachine ?? 'SWG-01',
    input.workOrderNo ?? null,
    input.customerCode ?? null,
    input.gradeCode ?? null,
    JSON.stringify(input.size ?? {}),
    input.swgDie ?? null,
    JSON.stringify(input.drawSize ?? {}),
    input.tagLenMm ?? null,
    input.lenAfterDieMm ?? null,
    input.pieces ?? null,
    input.tagNo ?? null,
    input.shiftRef ?? null,
    input.prodDate ?? null,
    input.status ?? 'DRAFT',
    input.dataSource ?? 'MANUAL',
    input.remarks ?? null,
    input.createdBy ?? null,
    input.materialLotId ?? null]

  );
  return mapSwage(row);
}

export async function updateSwageLot(id, input) {
  const row = await queryOne(
    `UPDATE txn.prod_db_swage SET
      linked_db_lot_id = COALESCE($3, linked_db_lot_id),
      swg_machine = COALESCE($4, swg_machine),
      work_order_no = COALESCE($5, work_order_no),
      customer_code = COALESCE($6, customer_code),
      grade_code = COALESCE($7, grade_code),
      size = COALESCE($8, size),
      swg_die = COALESCE($9, swg_die),
      draw_size = COALESCE($10, draw_size),
      tag_len_mm = COALESCE($11, tag_len_mm),
      len_after_die_mm = COALESCE($12, len_after_die_mm),
      pieces = COALESCE($13, pieces),
      tag_no = COALESCE($14, tag_no),
      shift_ref = COALESCE($15, shift_ref),
      prod_date = COALESCE($16, prod_date),
      remarks = COALESCE($17, remarks),
      material_lot_id = COALESCE($18, material_lot_id),
      updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status <> 'APPROVED'
     RETURNING *`,
    [
    id,
    config.tenantId,
    input.linkedDbLotId ?? null,
    input.swgMachine ?? null,
    input.workOrderNo ?? null,
    input.customerCode ?? null,
    input.gradeCode ?? null,
    input.size != null ? JSON.stringify(input.size) : null,
    input.swgDie ?? null,
    input.drawSize != null ? JSON.stringify(input.drawSize) : null,
    input.tagLenMm ?? null,
    input.lenAfterDieMm ?? null,
    input.pieces ?? null,
    input.tagNo ?? null,
    input.shiftRef ?? null,
    input.prodDate ?? null,
    input.remarks ?? null,
    input.materialLotId ?? null]

  );
  if (!row) throw new Error('Swage lot not found or locked');
  return mapSwage(row);
}

export async function setSwageStatus(id, status) {
  const row = await queryOne(
    `UPDATE txn.prod_db_swage SET status = $3, updated_at = now()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [id, config.tenantId, status]
  );
  if (!row) throw new Error('Swage lot not found');
  return mapSwage(row);
}

export async function listSwageMachines() {
  return query(
    `SELECT machine_code, label FROM master.machine
     WHERE tenant_id = $1 AND process_code = 'SWG' ORDER BY machine_code`,
    [config.tenantId]
  );
}