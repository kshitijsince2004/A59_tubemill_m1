import { query, queryOne } from '../db/pool';
import { config } from '../config';















function mapLot(row) {
  return {
    id: String(row.id),
    workOrderNo: row.work_order_no ?? null,
    lotTag: String(row.lot_tag),
    coilTag: row.coil_tag ?? null,
    customerCode: row.customer_code ?? null,
    gradeCode: row.grade_code ?? null,
    size: row.size,
    status: String(row.status),
    currentProcess: row.current_process ?? null,
    originProcess: row.origin_process ?? null,
    originRecordId: row.origin_record_id ?? null
  };
}

export async function upsertMaterialLotFromTm(input)







{
  const row = await queryOne(
    `INSERT INTO txn.material_lot (
       tenant_id, work_order_no, lot_tag, coil_tag, customer_code, grade_code, size,
       status, current_process, origin_process, origin_record_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'AVAILABLE','TM','TM',$8)
     ON CONFLICT (tenant_id, lot_tag) DO UPDATE SET
       work_order_no = COALESCE(EXCLUDED.work_order_no, txn.material_lot.work_order_no),
       coil_tag = COALESCE(EXCLUDED.coil_tag, txn.material_lot.coil_tag),
       customer_code = COALESCE(EXCLUDED.customer_code, txn.material_lot.customer_code),
       grade_code = COALESCE(EXCLUDED.grade_code, txn.material_lot.grade_code),
       size = COALESCE(EXCLUDED.size, txn.material_lot.size),
       status = 'AVAILABLE',
       current_process = 'TM',
       updated_at = now()
     RETURNING *`,
    [
    config.tenantId,
    input.workOrderNo ?? null,
    input.lotTag,
    input.coilTag ?? null,
    input.customerCode ?? null,
    input.gradeCode ?? null,
    JSON.stringify(input.size ?? {}),
    input.runId]

  );
  return mapLot(row);
}

/** On TM APPROVED: promote coils/bundles into material_lot for downstream pickers. */
export async function publishTmMaterialLots(runId) {
  const run = await queryOne(
    `SELECT * FROM txn.prod_tm_run WHERE id = $1 AND tenant_id = $2`,
    [runId, config.tenantId]
  );
  if (!run) return 0;

  const coils = await query(
    `SELECT coil_tag FROM txn.prod_tm_coil_input WHERE run_id = $1 AND coil_tag IS NOT NULL`,
    [runId]
  );
  const bundles = await query(
    `SELECT tag_no, bundle_no FROM txn.prod_tm_bundle WHERE run_id = $1`,
    [runId]
  );

  let n = 0;
  for (const c of coils) {
    const tag = String(c.coil_tag);
    if (!tag) continue;
    await upsertMaterialLotFromTm({
      workOrderNo: run.work_order_no ?? null,
      lotTag: tag,
      coilTag: tag,
      customerCode: run.customer_code ?? null,
      gradeCode: run.grade_code ?? null,
      size: run.size,
      runId
    });
    n += 1;
  }
  for (const b of bundles) {
    const tag = String(b.tag_no ?? `BND-${b.bundle_no}`);
    await upsertMaterialLotFromTm({
      workOrderNo: run.work_order_no ?? null,
      lotTag: tag,
      coilTag: null,
      customerCode: run.customer_code ?? null,
      gradeCode: run.grade_code ?? null,
      size: run.size,
      runId
    });
    n += 1;
  }
  if (!coils.length && !bundles.length) {
    const tag = `TM-${run.run_no ?? runId.slice(0, 8)}`;
    await upsertMaterialLotFromTm({
      workOrderNo: run.work_order_no ?? null,
      lotTag: tag,
      customerCode: run.customer_code ?? null,
      gradeCode: run.grade_code ?? null,
      size: run.size,
      runId
    });
    n += 1;
  }
  return n;
}

/** On FUR APPROVED: publish annealed charge as AVAILABLE material_lot for STP/DRW. */
export async function publishFurMaterialLots(runId) {
  const run = await queryOne(
    `SELECT * FROM txn.prod_ann_run WHERE id = $1 AND tenant_id = $2`,
    [runId, config.tenantId]
  );
  if (!run) return 0;

  const tag = String(run.charge_no ?? `FUR-${runId.slice(0, 8)}`);
  const row = await queryOne(
    `INSERT INTO txn.material_lot (
       tenant_id, work_order_no, lot_tag, coil_tag, customer_code, grade_code, size,
       status, current_process, origin_process, origin_record_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'AVAILABLE','FUR','FUR',$8)
     ON CONFLICT (tenant_id, lot_tag) DO UPDATE SET
       work_order_no = COALESCE(EXCLUDED.work_order_no, txn.material_lot.work_order_no),
       customer_code = COALESCE(EXCLUDED.customer_code, txn.material_lot.customer_code),
       grade_code = COALESCE(EXCLUDED.grade_code, txn.material_lot.grade_code),
       size = COALESCE(EXCLUDED.size, txn.material_lot.size),
       status = 'AVAILABLE',
       current_process = 'FUR',
       origin_process = 'FUR',
       origin_record_id = EXCLUDED.origin_record_id,
       updated_at = now()
     RETURNING *`,
    [
      config.tenantId,
      run.work_order_no ?? null,
      tag,
      null,
      run.customer_code ?? null,
      run.grade_code ?? null,
      JSON.stringify(run.size ?? {}),
      runId,
    ]
  );
  return row ? 1 : 0;
}

/** On DRW APPROVED: publish drawn lot as AVAILABLE material_lot for downstream. */
export async function publishDrwMaterialLots(lotId) {
  const lot = await queryOne(
    `SELECT * FROM txn.prod_db_lot WHERE id = $1 AND tenant_id = $2`,
    [lotId, config.tenantId]
  );
  if (!lot) return 0;

  const tag = String(lot.tag_no || lot.lot_no || `DRW-${lotId.slice(0, 8)}`);
  const size =
    lot.to_size ??
    (lot.to_od_mm != null
      ? { odMm: lot.to_od_mm, idMm: lot.to_id_mm, thkMm: lot.to_th_mm, lengthMm: lot.to_len_mm }
      : {});
  const row = await queryOne(
    `INSERT INTO txn.material_lot (
       tenant_id, work_order_no, lot_tag, coil_tag, customer_code, grade_code, size,
       status, current_process, origin_process, origin_record_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'AVAILABLE','DRW','DRW',$8)
     ON CONFLICT (tenant_id, lot_tag) DO UPDATE SET
       work_order_no = COALESCE(EXCLUDED.work_order_no, txn.material_lot.work_order_no),
       customer_code = COALESCE(EXCLUDED.customer_code, txn.material_lot.customer_code),
       grade_code = COALESCE(EXCLUDED.grade_code, txn.material_lot.grade_code),
       size = COALESCE(EXCLUDED.size, txn.material_lot.size),
       status = 'AVAILABLE',
       current_process = 'DRW',
       origin_process = 'DRW',
       origin_record_id = EXCLUDED.origin_record_id,
       updated_at = now()
     RETURNING *`,
    [
      config.tenantId,
      lot.work_order_no ?? null,
      tag,
      null,
      lot.customer_code ?? null,
      lot.grade_code ?? null,
      JSON.stringify(size ?? {}),
      lotId,
    ]
  );
  return row ? 1 : 0;
}

export async function listUpstreamLots(opts)


{
  const clauses = [`tenant_id = $1`, `status IN ('AVAILABLE','OPEN','IN_PROCESS')`];
  const params = [config.tenantId];
  let i = 2;
  if (opts.workOrderNo) {
    clauses.push(`work_order_no ILIKE $${i++}`);
    params.push(`%${opts.workOrderNo}%`);
  }
  // Prefer lots whose current_process is upstream of toProcess
  const upstreamOf = {
    FUR: ['TM'],
    STP: ['TM', 'FUR'],
    DRW: ['TM', 'FUR', 'STP', 'SWG'],
    SWG: ['TM', 'FUR', 'STP', 'DRW']
  };
  const allowed = upstreamOf[opts.toProcess];
  if (allowed?.length) {
    clauses.push(`(current_process = ANY($${i++}) OR current_process IS NULL)`);
    params.push(allowed);
  }
  const rows = await query(
    `SELECT * FROM txn.material_lot WHERE ${clauses.join(' AND ')}
     ORDER BY updated_at DESC LIMIT 100`,
    params
  );
  return rows.map(mapLot);
}

export async function attachMaterialLot(input)





{
  const lot = await queryOne(
    `SELECT * FROM txn.material_lot WHERE id = $1 AND tenant_id = $2`,
    [input.materialLotId, config.tenantId]
  );
  if (!lot) throw new Error('Material lot not found');

  const handoff = await queryOne(
    `INSERT INTO txn.process_handoff (
       tenant_id, material_lot_id, from_process, from_record_id, to_process, to_record_id, handed_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
    config.tenantId,
    input.materialLotId,
    input.fromProcess ?? lot.current_process ?? 'TM',
    lot.origin_record_id ?? null,
    input.toProcess,
    input.toRecordId,
    input.handedBy ?? null]

  );

  await query(
    `UPDATE txn.material_lot SET current_process = $2, status = 'IN_PROCESS', updated_at = now()
     WHERE id = $1`,
    [input.materialLotId, input.toProcess]
  );

  const table =
  input.toProcess === 'FUR' ?
  'txn.prod_ann_run' :
  input.toProcess === 'STP' ?
  'txn.prod_stp_lot' :
  input.toProcess === 'DRW' ?
  'txn.prod_db_lot' :
  input.toProcess === 'SWG' ?
  'txn.prod_db_swage' :
  null;
  if (table) {
    await query(
      `UPDATE ${table} SET material_lot_id = $2, upstream_handoff_id = $3 WHERE id = $1 AND tenant_id = $4`,
      [input.toRecordId, input.materialLotId, handoff.id, config.tenantId]
    ).catch(async () => {
      // swage may lack upstream_handoff_id
      await query(`UPDATE ${table} SET material_lot_id = $2 WHERE id = $1 AND tenant_id = $3`, [
      input.toRecordId,
      input.materialLotId,
      config.tenantId]
      );
    });
  }

  return { handoffId: String(handoff.id) };
}

export async function getGenealogy(materialLotId) {
  const lot = await queryOne(`SELECT * FROM txn.material_lot WHERE id = $1 AND tenant_id = $2`, [
  materialLotId,
  config.tenantId]
  );
  if (!lot) return null;
  const handoffs = await query(
    `SELECT * FROM txn.process_handoff WHERE material_lot_id = $1 AND tenant_id = $2 ORDER BY handed_at`,
    [materialLotId, config.tenantId]
  );
  return { lot: mapLot(lot), handoffs };
}