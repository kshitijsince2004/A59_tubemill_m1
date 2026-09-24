import { query, queryOne, withTransaction } from '../db/pool';
import { config } from '../config';

function mapLot(row) {
  const pickle = row.pickle_time_min != null ? Number(row.pickle_time_min) : null;
  const descale = row.descale_time_min != null ? Number(row.descale_time_min) : null;
  return {
    id: row.id,
    lotNo: row.lot_no,
    customerCode: row.customer_code,
    gradeCode: row.grade_code,
    workOrderNo: row.work_order_no,
    workOrderLineNo: row.work_order_line_no != null ? Number(row.work_order_line_no) : null,
    size: row.size,
    qtyNo: row.qty_no != null ? Number(row.qty_no) : null,
    qtyMt: row.qty_mt != null ? Number(row.qty_mt) : null,
    machineCode: row.machine_code,
    degreaseTempC: row.degrease_temp_c != null ? Number(row.degrease_temp_c) : null,
    degreaseTimeMin: row.degrease_time_min != null ? Number(row.degrease_time_min) : null,
    pickleTimeMin: pickle ?? descale,
    descaleTimeMin: descale ?? pickle,
    phosphateTempC: row.phosphate_temp_c != null ? Number(row.phosphate_temp_c) : null,
    phosphateTimeMin: row.phosphate_time_min != null ? Number(row.phosphate_time_min) : null,
    neutralizerTimeMin: row.neutralizer_time_min != null ? Number(row.neutralizer_time_min) : null,
    neutTempC: row.neut_temp_c != null ? Number(row.neut_temp_c) : null,
    lubeTempC: row.lube_temp_c != null ? Number(row.lube_temp_c) : null,
    lubeTimeMin: row.lube_time_min != null ? Number(row.lube_time_min) : null,
    dryerTempC: row.dryer_temp_c != null ? Number(row.dryer_temp_c) : null,
    dryerTimeMin: row.dryer_time_min != null ? Number(row.dryer_time_min) : null,
    sfNeutTempC: row.sf_neut_temp_c != null ? Number(row.sf_neut_temp_c) : null,
    reactiveOilTimeMin: row.reactive_oil_time_min != null ? Number(row.reactive_oil_time_min) : null,
    surfaceFinish: row.surface_finish,
    chemAddition: row.chem_addition,
    breakdownRemark: row.breakdown_remark,
    craneState: row.crane_state,
    disposition: row.disposition ?? null,
    bathSignOffBy: row.bath_sign_off_by ?? null,
    bathSignOffAt: row.bath_sign_off_at ?? null,
    bathSignOffNote: row.bath_sign_off_note ?? null,
    shiftRef: row.shift_ref,
    prodDate: row.prod_date,
    status: row.status,
    dataSource: row.data_source,
    remarks: row.remarks,
    materialLotId: row.material_lot_id,
    upstreamHandoffId: row.upstream_handoff_id,
    productionStartedAt: row.production_started_at ?? null,
    productionEndedAt: row.production_ended_at ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function mapOrderLine(row) {
  return {
    id: row.id,
    workOrderNo: row.work_order_no,
    lineNo: Number(row.line_no),
    customerCode: row.customer_code,
    gradeCode: row.grade_code,
    lotNo: row.lot_no,
    coilNo: row.coil_no,
    tdc: row.tdc,
    passNo: row.pass_no != null ? Number(row.pass_no) : null,
    size: row.size,
    qtyPieces: row.qty_pieces != null ? Number(row.qty_pieces) : null,
    plannedQty: row.planned_qty != null ? Number(row.planned_qty) : null,
    finalSize: row.final_size,
    tubeShape: row.tube_shape,
    nextProcess: row.next_process,
    remarks: row.remarks,
  };
}

function mapChem(row) {
  return {
    id: row.id,
    lotId: row.lot_id,
    bathCode: row.bath_code,
    chemical: row.chemical,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    unit: row.unit,
    batchRef: row.batch_ref,
    remarks: row.remarks,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function listStpLots(filter = {}) {
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
  if (filter.fromDate) {
    clauses.push(`prod_date >= $${i++}`);
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    clauses.push(`prod_date <= $${i++}`);
    params.push(filter.toDate);
  }
  const rows = await query(
    `SELECT * FROM txn.prod_stp_lot WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return rows.map(mapLot);
}

export async function getStpLot(id) {
  const row = await queryOne(`SELECT * FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!row) return null;
  const [baths, coatings, chems] = await Promise.all([
    query(`SELECT * FROM txn.stp_bath_analysis WHERE lot_id = $1 ORDER BY sampled_at`, [id]),
    query(`SELECT * FROM txn.stp_coating WHERE lot_id = $1 ORDER BY sample_date`, [id]),
    query(
      `SELECT * FROM txn.stp_chemical_addition WHERE lot_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [id, config.tenantId]
    ),
  ]);
  return {
    ...mapLot(row),
    bathAnalyses: baths,
    coatings,
    chemicalAdditions: chems.map(mapChem),
  };
}

export async function createStpLot(input) {
  const descale = input.descaleTimeMin ?? input.pickleTimeMin ?? null;
  const row = await queryOne(
    `INSERT INTO txn.prod_stp_lot (
      tenant_id, lot_no, customer_code, grade_code, work_order_no, size, qty_no, qty_mt, machine_code,
      degrease_temp_c, degrease_time_min, pickle_time_min, phosphate_temp_c, phosphate_time_min,
      neutralizer_time_min, lube_temp_c, lube_time_min, dryer_time_min, reactive_oil_time_min,
      surface_finish, chem_addition, breakdown_remark, crane_state,
      shift_ref, prod_date, status, data_source, remarks, created_by,
      descale_time_min, neut_temp_c, dryer_temp_c, sf_neut_temp_c, material_lot_id, upstream_handoff_id,
      work_order_line_no, disposition
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
      $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,
      $30,$31,$32,$33,$34,$35,$36,$37
    ) RETURNING *`,
    [
      config.tenantId,
      input.lotNo,
      input.customerCode ?? null,
      input.gradeCode ?? null,
      input.workOrderNo ?? null,
      JSON.stringify(input.size ?? {}),
      input.qtyNo ?? null,
      input.qtyMt ?? null,
      input.machineCode ?? 'STP-LINE',
      input.degreaseTempC ?? null,
      input.degreaseTimeMin ?? null,
      descale,
      input.phosphateTempC ?? null,
      input.phosphateTimeMin ?? null,
      input.neutralizerTimeMin ?? null,
      input.lubeTempC ?? null,
      input.lubeTimeMin ?? null,
      input.dryerTimeMin ?? null,
      input.reactiveOilTimeMin ?? null,
      input.surfaceFinish ?? null,
      input.chemAddition ?? null,
      input.breakdownRemark ?? null,
      input.craneState ?? null,
      input.shiftRef ?? null,
      input.prodDate ?? null,
      input.status ?? 'DRAFT',
      input.dataSource ?? 'MANUAL',
      input.remarks ?? null,
      input.createdBy ?? null,
      descale,
      input.neutTempC ?? null,
      input.dryerTempC ?? null,
      input.sfNeutTempC ?? null,
      input.materialLotId ?? null,
      input.upstreamHandoffId ?? null,
      input.workOrderLineNo ?? null,
      input.disposition ?? null,
    ]
  );
  try {
    const { activeShiftLogId } = await import('./handover/productionGuard.js');
    const sid = await activeShiftLogId(input.machineCode ?? 'STP-LINE');
    if (sid && row?.id) {
      await query(`UPDATE txn.prod_stp_lot SET shift_log_id = $1 WHERE id = $2 AND tenant_id = $3`, [
        sid,
        row.id,
        config.tenantId,
      ]);
      row.shift_log_id = sid;
    }
  } catch {
    /* best-effort */
  }
  return mapLot(row);
}

export async function updateStpLot(id, input) {
  const existing = await queryOne(`SELECT * FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('STP lot not found');
  if (existing.status === 'APPROVED') throw new Error('Cannot edit APPROVED lot');

  const descale =
    input.descaleTimeMin ?? input.pickleTimeMin ?? null;

  const row = await queryOne(
    `UPDATE txn.prod_stp_lot SET
      customer_code = COALESCE($3, customer_code),
      grade_code = COALESCE($4, grade_code),
      work_order_no = COALESCE($5, work_order_no),
      size = COALESCE($6, size),
      qty_no = COALESCE($7, qty_no),
      qty_mt = COALESCE($8, qty_mt),
      machine_code = COALESCE($9, machine_code),
      degrease_temp_c = COALESCE($10, degrease_temp_c),
      degrease_time_min = COALESCE($11, degrease_time_min),
      pickle_time_min = COALESCE($12, pickle_time_min),
      phosphate_temp_c = COALESCE($13, phosphate_temp_c),
      phosphate_time_min = COALESCE($14, phosphate_time_min),
      neutralizer_time_min = COALESCE($15, neutralizer_time_min),
      lube_temp_c = COALESCE($16, lube_temp_c),
      lube_time_min = COALESCE($17, lube_time_min),
      dryer_time_min = COALESCE($18, dryer_time_min),
      reactive_oil_time_min = COALESCE($19, reactive_oil_time_min),
      surface_finish = COALESCE($20, surface_finish),
      chem_addition = COALESCE($21, chem_addition),
      breakdown_remark = COALESCE($22, breakdown_remark),
      crane_state = COALESCE($23, crane_state),
      shift_ref = COALESCE($24, shift_ref),
      prod_date = COALESCE($25, prod_date),
      data_source = COALESCE($26, data_source),
      remarks = COALESCE($27, remarks),
      descale_time_min = COALESCE($28, descale_time_min),
      neut_temp_c = COALESCE($29, neut_temp_c),
      dryer_temp_c = COALESCE($30, dryer_temp_c),
      sf_neut_temp_c = COALESCE($31, sf_neut_temp_c),
      material_lot_id = COALESCE($32, material_lot_id),
      upstream_handoff_id = COALESCE($33, upstream_handoff_id),
      work_order_line_no = COALESCE($34, work_order_line_no),
      disposition = COALESCE($35, disposition),
      updated_at = now()
    WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [
      id,
      config.tenantId,
      input.customerCode ?? null,
      input.gradeCode ?? null,
      input.workOrderNo ?? null,
      input.size != null ? JSON.stringify(input.size) : null,
      input.qtyNo ?? null,
      input.qtyMt ?? null,
      input.machineCode ?? null,
      input.degreaseTempC ?? null,
      input.degreaseTimeMin ?? null,
      descale,
      input.phosphateTempC ?? null,
      input.phosphateTimeMin ?? null,
      input.neutralizerTimeMin ?? null,
      input.lubeTempC ?? null,
      input.lubeTimeMin ?? null,
      input.dryerTimeMin ?? null,
      input.reactiveOilTimeMin ?? null,
      input.surfaceFinish ?? null,
      input.chemAddition ?? null,
      input.breakdownRemark ?? null,
      input.craneState ?? null,
      input.shiftRef ?? null,
      input.prodDate ?? null,
      input.dataSource ?? null,
      input.remarks ?? null,
      descale,
      input.neutTempC ?? null,
      input.dryerTempC ?? null,
      input.sfNeutTempC ?? null,
      input.materialLotId ?? null,
      input.upstreamHandoffId ?? null,
      input.workOrderLineNo ?? null,
      input.disposition ?? null,
    ]
  );
  return mapLot(row);
}

export async function setStpStatus(id, status) {
  const row = await queryOne(
    `UPDATE txn.prod_stp_lot SET status = $3, updated_at = now()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [id, config.tenantId, status]
  );
  if (!row) throw new Error('STP lot not found');
  if (status === 'APPROVED') {
    try {
      const { enqueueStpWriteback } = await import('../erp/ErpWritebackService.js');
      await enqueueStpWriteback(id);
    } catch (err) {
      console.warn('[erp] STP writeback enqueue failed:', err instanceof Error ? err.message : err);
    }
  }
  return mapLot(row);
}

export async function addBathAnalysis(input) {
  return queryOne(
    `INSERT INTO txn.stp_bath_analysis (
      tenant_id, lot_id, sampled_at, degrease_ta, hcl_pct, fe_pct, activation_ph,
      phos_ta, phos_fa, phos_acc, phos_oxta, neut_ph, lube_con, lube_fa, lube_ph, rinse_ph,
      oil_water_acid_no, remarks
    ) VALUES (
      $1,$2,COALESCE($3::timestamptz, now()),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    ) RETURNING *`,
    [
      config.tenantId,
      input.lotId || null,
      input.sampledAt ?? null,
      input.degreaseTa ?? null,
      input.hclPct ?? null,
      input.fePct ?? null,
      input.activationPh ?? null,
      input.phosTa ?? null,
      input.phosFa ?? null,
      input.phosAcc ?? null,
      input.phosOxta ?? null,
      input.neutPh ?? null,
      input.lubeCon ?? null,
      input.lubeFa ?? null,
      input.lubePh ?? null,
      input.rinsePh ?? null,
      input.oilWaterAcidNo ?? null,
      input.remarks ?? null,
    ]
  );
}

export async function addCoating(input) {
  return queryOne(
    `INSERT INTO txn.stp_coating (tenant_id, lot_id, sample_date, coating_gm2, sample_no, remarks)
     VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5,$6) RETURNING *`,
    [
      config.tenantId,
      input.lotId ?? null,
      input.sampleDate ?? null,
      input.coatingGm2 ?? null,
      input.sampleNo ?? null,
      input.remarks ?? null,
    ]
  );
}

export async function addBathHistory(input) {
  return queryOne(
    `INSERT INTO txn.stp_bath_history (
      tenant_id, bath_code, planned_change_date, executed_change_date, planned_freq_days, remarks
    ) VALUES ($1,$2,$3::date,$4::date,$5,$6) RETURNING *`,
    [
      config.tenantId,
      input.bathCode,
      input.plannedChangeDate ?? null,
      input.executedChangeDate ?? null,
      input.plannedFreqDays ?? null,
      input.remarks ?? null,
    ]
  );
}

export async function listBathHistory() {
  return query(
    `SELECT * FROM txn.stp_bath_history WHERE tenant_id = $1 ORDER BY planned_change_date DESC NULLS LAST LIMIT 100`,
    [config.tenantId]
  );
}

export async function listBathSpecs() {
  const rows = await query(
    `SELECT bath_code, bath_label, param_key, min_val, max_val, unit
     FROM master.stp_bath_spec WHERE tenant_id = $1
     ORDER BY bath_code, param_key`,
    [config.tenantId]
  );
  return rows.map((r) => ({
    bathCode: r.bath_code,
    bathLabel: r.bath_label,
    paramKey: r.param_key,
    minVal: r.min_val != null ? Number(r.min_val) : null,
    maxVal: r.max_val != null ? Number(r.max_val) : null,
    unit: r.unit,
  }));
}

/**
 * Validate observed bath analysis values against master.stp_bath_spec (WARN only).
 * Also runs shared stpBathAnalysisRules for paper ranges.
 */
export async function validateBathAgainstSpec(input) {
  const { validateRecord, STP_BATH_FIELD_SPEC, stpBathAnalysisRules } = await import('@a59/shared');
  const specs = await listBathSpecs();
  const byKey = new Map(specs.map((s) => [`${s.bathCode}:${s.paramKey}`, s]));
  const issues = validateRecord(stpBathAnalysisRules, input);

  for (const def of STP_BATH_FIELD_SPEC) {
    const val = input[def.field];
    if (val == null || val === '') continue;
    const n = Number(val);
    if (Number.isNaN(n)) continue;
    const spec = byKey.get(`${def.bathCode}:${def.paramKey}`);
    if (spec && spec.minVal != null && spec.maxVal != null) {
      if (n < spec.minVal || n > spec.maxVal) {
        const already = issues.some((i) => i.field === def.field && i.code === 'RANGE');
        if (!already) {
          issues.push({
            field: def.field,
            code: 'RANGE',
            message: `${def.label} ${n} out of ${spec.minVal}–${spec.maxVal}`,
            severity: 'WARN',
          });
        }
      }
    }
  }

  return issues;
}

export async function listStpOrders(status = 'Released') {
  const orders = await query(
    `SELECT work_order_no, bc_id, status, mill_code, customer_code, grade_code, lot_no, size,
            qty_pieces, planned_qty
     FROM erp.released_order
     WHERE tenant_id = $1 AND status = $2
     ORDER BY work_order_no DESC`,
    [config.tenantId, status]
  );
  const lines = await query(
    `SELECT * FROM erp.released_order_line WHERE tenant_id = $1 ORDER BY work_order_no, line_no`,
    [config.tenantId]
  );
  const byWo = new Map();
  for (const l of lines) {
    const key = l.work_order_no;
    if (!byWo.has(key)) byWo.set(key, []);
    byWo.get(key).push(mapOrderLine(l));
  }
  return orders.map((o) => {
    const mappedLines = byWo.get(o.work_order_no) ?? [];
    if (!mappedLines.length) {
      mappedLines.push({
        id: null,
        workOrderNo: o.work_order_no,
        lineNo: 1,
        customerCode: o.customer_code,
        gradeCode: o.grade_code,
        lotNo: o.lot_no,
        coilNo: o.lot_no,
        tdc: null,
        passNo: null,
        size: o.size,
        qtyPieces: o.qty_pieces != null ? Number(o.qty_pieces) : null,
        plannedQty: o.planned_qty != null ? Number(o.planned_qty) : null,
        finalSize: null,
        tubeShape: o.size?.profile ?? null,
        nextProcess: null,
        remarks: null,
      });
    }
    return {
      workOrderNo: o.work_order_no,
      bcId: o.bc_id,
      status: o.status,
      millCode: o.mill_code,
      customerCode: o.customer_code,
      gradeCode: o.grade_code,
      lotNo: o.lot_no,
      size: o.size,
      qtyPieces: o.qty_pieces != null ? Number(o.qty_pieces) : null,
      plannedQty: o.planned_qty != null ? Number(o.planned_qty) : null,
      lines: mappedLines,
    };
  });
}

function currentShiftRef() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

export async function assignStpOrder(input = {}) {
  const workOrderNo = String(input.workOrderNo ?? '').trim();
  const lineNo = Number(input.lineNo ?? 1);
  if (!workOrderNo) throw new Error('workOrderNo is required');
  if (!Number.isFinite(lineNo) || lineNo < 1) throw new Error('lineNo is required');

  const line =
    (await queryOne(
      `SELECT * FROM erp.released_order_line
       WHERE tenant_id = $1 AND work_order_no = $2 AND line_no = $3`,
      [config.tenantId, workOrderNo, lineNo]
    )) ?? null;

  const order = await queryOne(
    `SELECT * FROM erp.released_order WHERE tenant_id = $1 AND work_order_no = $2`,
    [config.tenantId, workOrderNo]
  );
  if (!order && !line) throw new Error(`Work order ${workOrderNo} not found`);

  const lotNo = `STP-${workOrderNo}-L${lineNo}-${Date.now().toString(36).toUpperCase()}`;
  const size = line?.size ?? order?.size ?? {};
  const row = await queryOne(
    `INSERT INTO txn.prod_stp_lot (
       tenant_id, lot_no, customer_code, grade_code, work_order_no, work_order_line_no,
       size, qty_no, qty_mt, machine_code, shift_ref, prod_date, status, data_source, created_by
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_DATE,'DRAFT','MANUAL',$12
     ) RETURNING *`,
    [
      config.tenantId,
      lotNo,
      line?.customer_code ?? order?.customer_code ?? null,
      line?.grade_code ?? order?.grade_code ?? null,
      workOrderNo,
      lineNo,
      JSON.stringify(size ?? {}),
      line?.qty_pieces ?? order?.qty_pieces ?? null,
      line?.planned_qty ?? order?.planned_qty ?? null,
      input.machineCode ?? 'STP-LINE',
      input.shiftRef ?? currentShiftRef(),
      input.createdBy ?? null,
    ]
  );
  return mapLot(row);
}

export async function startStpProduction(id) {
  const existing = await queryOne(`SELECT * FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('STP lot not found');
  if (existing.status === 'APPROVED') throw new Error('Cannot start an APPROVED lot');
  if (existing.production_ended_at) throw new Error('Production already ended');
  if (!existing.work_order_no) throw new Error('Work order required before Start');
  if (existing.production_started_at) {
    await ensureStpStages(id, { activateFirst: true });
    return mapLot(existing);
  }

  const openStop = await queryOne(
    `SELECT id FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND process_code = 'STP' AND source_id = $2 AND is_open = true
     LIMIT 1`,
    [config.tenantId, id]
  );
  if (openStop) throw new Error('End open stoppage before Start');

  return withTransaction(async (client) => {
    const row = await queryOne(
      `UPDATE txn.prod_stp_lot SET production_started_at = now(), updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, config.tenantId],
      client
    );
    await ensureStpStages(id, { activateFirst: true }, client);
    return mapLot(row);
  });
}

export async function endStpProduction(id) {
  const existing = await queryOne(`SELECT * FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('STP lot not found');
  if (existing.status === 'APPROVED') throw new Error('Lot already approved');
  if (!existing.production_started_at) throw new Error('Start production before End');
  if (existing.production_ended_at) return mapLot(existing);

  return withTransaction(async (client) => {
    try {
      const { closeProcessStoppage } = await import('./ProcessStoppageService.js');
      await closeProcessStoppage('STP', id, client);
    } catch {
      /* no open stoppage */
    }

    const row = await queryOne(
      `UPDATE txn.prod_stp_lot SET production_ended_at = now(), updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, config.tenantId],
      client
    );
    return mapLot(row);
  });
}

export async function holdStpLot(id) {
  return setStpStatus(id, 'HOLD');
}

export async function signOffBath(id, { signedBy, note } = {}) {
  const row = await queryOne(
    `UPDATE txn.prod_stp_lot SET
       bath_sign_off_by = $2,
       bath_sign_off_at = now(),
       bath_sign_off_note = $3,
       updated_at = now()
     WHERE id = $1 AND tenant_id = $4
     RETURNING *`,
    [id, signedBy ?? 'MACHINE_HEAD', note ?? null, config.tenantId]
  );
  return row ? mapLot(row) : null;
}

/**
 * If latest bath analysis has out-of-spec WARNs, require bath_sign_off_at.
 */
export async function assertStpBathSigned(lotId, lot) {
  const rows = await query(`SELECT * FROM txn.stp_bath_analysis WHERE lot_id = $1 AND tenant_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [lotId, config.tenantId]
  );
  if (!rows.length) return;
  const latest = rows[0];
  const input = {
    degreaseTa: latest.degrease_ta,
    hclPct: latest.hcl_pct,
    fePct: latest.fe_pct,
    activationPh: latest.activation_ph,
    phosTa: latest.phos_ta,
    phosFa: latest.phos_fa,
    phosAcc: latest.phos_acc,
    phosOxta: latest.phos_oxta,
    neutPh: latest.neut_ph,
    lubeCon: latest.lube_con,
    lubeFa: latest.lube_fa,
    lubePh: latest.lube_ph,
    rinsePh: latest.rinse_ph,
    oilWaterAcidNo: latest.oil_water_acid_no,
  };
  const warnings = await validateBathAgainstSpec(input);
  const outOfSpec = warnings.filter((w) => w.severity === 'WARN' || w.code === 'RANGE');
  if (outOfSpec.length && !lot.bathSignOffAt) {
    const err = new Error('Bath out-of-spec requires Machine Head bath sign-off before approve');
    err.status = 422;
    err.issues = outOfSpec;
    throw err;
  }
}

export async function addChemicalAddition(input) {
  const row = await queryOne(
    `INSERT INTO txn.stp_chemical_addition (
       tenant_id, lot_id, bath_code, chemical, quantity, unit, batch_ref, remarks, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      config.tenantId,
      input.lotId || null,
      input.bathCode,
      input.chemical,
      input.quantity ?? null,
      input.unit ?? null,
      input.batchRef ?? null,
      input.remarks ?? null,
      input.createdBy ?? null,
    ]
  );
  return mapChem(row);
}

export async function listChemicalAdditions(filter = {}) {
  const clauses = ['c.tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filter.lotId) {
    clauses.push(`c.lot_id = $${i++}`);
    params.push(filter.lotId);
  }
  if (filter.fromDate) {
    clauses.push(`c.created_at >= $${i++}::timestamptz`);
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    clauses.push(`c.created_at <= $${i++}::timestamptz`);
    params.push(filter.toDate);
  }
  const rows = await query(
    `SELECT c.*, l.lot_no, l.work_order_no, l.work_order_line_no
     FROM txn.stp_chemical_addition c
     LEFT JOIN txn.prod_stp_lot l ON l.id = c.lot_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY c.created_at DESC LIMIT 200`,
    params
  );
  return rows.map((r) => ({
    ...mapChem(r),
    lotNo: r.lot_no,
    workOrderNo: r.work_order_no,
    workOrderLineNo: r.work_order_line_no != null ? Number(r.work_order_line_no) : null,
  }));
}

export async function listBathAnalysisHistory(filter = {}) {
  const clauses = ['b.tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filter.fromDate) {
    clauses.push(`b.sampled_at >= $${i++}::timestamptz`);
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    clauses.push(`b.sampled_at <= $${i++}::timestamptz`);
    params.push(filter.toDate);
  }
  if (filter.workOrderNo) {
    clauses.push(`l.work_order_no ILIKE $${i++}`);
    params.push(`%${filter.workOrderNo}%`);
  }
  const rows = await query(
    `SELECT b.*, l.lot_no, l.work_order_no, l.work_order_line_no, l.shift_ref, l.prod_date
     FROM txn.stp_bath_analysis b
     LEFT JOIN txn.prod_stp_lot l ON l.id = b.lot_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY b.sampled_at DESC LIMIT 200`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    lotId: r.lot_id,
    lotNo: r.lot_no,
    workOrderNo: r.work_order_no,
    workOrderLineNo: r.work_order_line_no != null ? Number(r.work_order_line_no) : null,
    sampledAt: r.sampled_at,
    shiftRef: r.shift_ref,
    prodDate: r.prod_date,
    degreaseTa: r.degrease_ta != null ? Number(r.degrease_ta) : null,
    hclPct: r.hcl_pct != null ? Number(r.hcl_pct) : null,
    fePct: r.fe_pct != null ? Number(r.fe_pct) : null,
    activationPh: r.activation_ph != null ? Number(r.activation_ph) : null,
    phosTa: r.phos_ta != null ? Number(r.phos_ta) : null,
    phosFa: r.phos_fa != null ? Number(r.phos_fa) : null,
    phosAcc: r.phos_acc != null ? Number(r.phos_acc) : null,
    phosOxta: r.phos_oxta != null ? Number(r.phos_oxta) : null,
    neutPh: r.neut_ph != null ? Number(r.neut_ph) : null,
    lubeCon: r.lube_con != null ? Number(r.lube_con) : null,
    lubeFa: r.lube_fa != null ? Number(r.lube_fa) : null,
    lubePh: r.lube_ph != null ? Number(r.lube_ph) : null,
    rinsePh: r.rinse_ph != null ? Number(r.rinse_ph) : null,
    oilWaterAcidNo: r.oil_water_acid_no != null ? Number(r.oil_water_acid_no) : null,
    remarks: r.remarks,
  }));
}

export async function listStpStoppageHistory(filter = {}) {
  const clauses = [`s.tenant_id = $1`, `s.process_code = 'STP'`];
  const params = [config.tenantId];
  let i = 2;
  if (filter.fromDate) {
    clauses.push(`s.from_time >= $${i++}::timestamptz`);
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    clauses.push(`s.from_time <= $${i++}::timestamptz`);
    params.push(filter.toDate);
  }
  const rows = await query(
    `SELECT s.*, l.lot_no, l.work_order_no, l.work_order_line_no, l.machine_code
     FROM txn.stoppage_entry s
     LEFT JOIN txn.prod_stp_lot l ON l.id = s.source_id AND l.tenant_id = s.tenant_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY s.from_time DESC LIMIT 200`,
    params
  );
  return rows.map((s) => ({
    id: s.id,
    sourceId: s.source_id,
    lotNo: s.lot_no,
    workOrderNo: s.work_order_no,
    workOrderLineNo: s.work_order_line_no != null ? Number(s.work_order_line_no) : null,
    machineCode: s.machine_code ?? s.mill_code,
    stoppageCode: s.stoppage_code,
    fromTime: s.from_time,
    toTime: s.to_time,
    isOpen: s.is_open === true || s.is_open === 1 || s.is_open === 't' || s.is_open === 'true',
    reason: s.reason,
  }));
}

/** STP monitoring stage catalog — codes must match client MONITOR_STAGES. */
export const STP_STAGE_DEFS = [
  { code: 'DEGREASE', sortOrd: 1, na: false, timeField: 'degrease_time_min', timeKey: 'degreaseTimeMin' },
  { code: 'PICKLE', sortOrd: 2, na: false, timeField: 'descale_time_min', timeKey: 'descaleTimeMin' },
  { code: 'RINSE', sortOrd: 3, na: true, timeField: null, timeKey: null },
  { code: 'ACT', sortOrd: 4, na: true, timeField: null, timeKey: null },
  { code: 'PHOS', sortOrd: 5, na: false, timeField: 'phosphate_time_min', timeKey: 'phosphateTimeMin' },
  { code: 'NEUT', sortOrd: 6, na: false, timeField: 'neutralizer_time_min', timeKey: 'neutralizerTimeMin' },
  { code: 'LUBE', sortOrd: 7, na: false, timeField: 'lube_time_min', timeKey: 'lubeTimeMin' },
  { code: 'DRYER', sortOrd: 8, na: false, timeField: 'dryer_time_min', timeKey: 'dryerTimeMin' },
  { code: 'OIL', sortOrd: 9, na: false, timeField: 'reactive_oil_time_min', timeKey: 'reactiveOilTimeMin' },
];

function mapStage(row) {
  return {
    id: row.id,
    lotId: row.lot_id,
    stageCode: row.stage_code,
    sortOrd: Number(row.sort_ord),
    status: row.status,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    durationMin: row.duration_min != null ? Number(row.duration_min) : null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function listStpStages(lotId, client) {
  const lot = await queryOne(`SELECT id FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
    lotId,
    config.tenantId,
  ], client);
  if (!lot) throw new Error('STP lot not found');
  const rows = await query(
    `SELECT * FROM txn.stp_process_stage
     WHERE lot_id = $1 AND tenant_id = $2
     ORDER BY sort_ord ASC`,
    [lotId, config.tenantId],
    client
  );
  return rows.map(mapStage);
}

/**
 * Idempotent: create stage rows for a lot. Optionally activate first non-NA PENDING
 * when production has started and nothing is ACTIVE.
 */
export async function ensureStpStages(lotId, opts = {}, client) {
  const run = async (c) => {
    const lot = await queryOne(`SELECT * FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
      lotId,
      config.tenantId,
    ], c);
    if (!lot) throw new Error('STP lot not found');

    for (const def of STP_STAGE_DEFS) {
      await queryOne(
        `INSERT INTO txn.stp_process_stage (
           tenant_id, lot_id, stage_code, sort_ord, status
         ) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (lot_id, stage_code) DO NOTHING
         RETURNING id`,
        [config.tenantId, lotId, def.code, def.sortOrd, def.na ? 'NA' : 'PENDING'],
        c
      );
    }

    const activateFirst = opts.activateFirst !== false && !!lot.production_started_at && !lot.production_ended_at;
    if (activateFirst) {
      const active = await queryOne(
        `SELECT id FROM txn.stp_process_stage
         WHERE lot_id = $1 AND tenant_id = $2 AND status = 'ACTIVE' LIMIT 1`,
        [lotId, config.tenantId],
        c
      );
      if (!active) {
        const first = await queryOne(
          `SELECT * FROM txn.stp_process_stage
           WHERE lot_id = $1 AND tenant_id = $2 AND status = 'PENDING'
           ORDER BY sort_ord ASC LIMIT 1`,
          [lotId, config.tenantId],
          c
        );
        if (first) {
          await queryOne(
            `UPDATE txn.stp_process_stage
             SET status = 'ACTIVE', started_at = COALESCE(started_at, now()), updated_at = now()
             WHERE id = $1 RETURNING *`,
            [first.id],
            c
          );
        }
      }
    }

    return listStpStages(lotId, c);
  };

  if (client) return run(client);
  return withTransaction(run);
}

async function autoFillStageTime(lotId, stageCode, durationMin, client) {
  const def = STP_STAGE_DEFS.find((d) => d.code === stageCode);
  if (!def?.timeField || durationMin == null) return;
  const lot = await queryOne(`SELECT * FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
    lotId,
    config.tenantId,
  ], client);
  if (!lot) return;
  const current = lot[def.timeField];
  if (current != null) return;
  await queryOne(
    `UPDATE txn.prod_stp_lot SET ${def.timeField} = $3, updated_at = now()
     WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [lotId, config.tenantId, durationMin],
    client
  );
}

/**
 * End ACTIVE stage, auto-fill duration into lot time column when empty,
 * skip NA, activate next PENDING. Requires RUNNING production clock and no open stoppage.
 */
export async function advanceStpStage(lotId) {
  const lot = await queryOne(`SELECT * FROM txn.prod_stp_lot WHERE id = $1 AND tenant_id = $2`, [
    lotId,
    config.tenantId,
  ]);
  if (!lot) throw new Error('STP lot not found');
  if (!lot.production_started_at) throw new Error('Start production before advancing stages');
  if (lot.production_ended_at) throw new Error('Production already ended');

  const openStop = await queryOne(
    `SELECT id FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND process_code = 'STP' AND source_id = $2 AND is_open = true
     LIMIT 1`,
    [config.tenantId, lotId]
  );
  if (openStop) throw new Error('End open stoppage before advancing');

  await withTransaction(async (client) => {
    await ensureStpStages(lotId, { activateFirst: true }, client);

    const active = await queryOne(
      `SELECT * FROM txn.stp_process_stage
       WHERE lot_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'
       ORDER BY sort_ord ASC LIMIT 1`,
      [lotId, config.tenantId],
      client
    );
    if (!active) throw new Error('No active stage to advance');

    const endedAt = new Date();
    const started = active.started_at ? new Date(active.started_at) : endedAt;
    const durationMin = Math.max(0, (endedAt.getTime() - started.getTime()) / 60000);
    const durationRounded = Math.round(durationMin * 1000) / 1000;

    await queryOne(
      `UPDATE txn.stp_process_stage
       SET status = 'COMPLETE', ended_at = $2, duration_min = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [active.id, endedAt.toISOString(), durationRounded],
      client
    );
    await autoFillStageTime(lotId, active.stage_code, durationRounded, client);

    const next = await queryOne(
      `SELECT * FROM txn.stp_process_stage
       WHERE lot_id = $1 AND tenant_id = $2 AND status = 'PENDING'
       ORDER BY sort_ord ASC LIMIT 1`,
      [lotId, config.tenantId],
      client
    );
    if (next) {
      await queryOne(
        `UPDATE txn.stp_process_stage
         SET status = 'ACTIVE', started_at = now(), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [next.id],
        client
      );
    }
  });

  const stages = await listStpStages(lotId);
  const updatedLot = await getStpLot(lotId);
  return { stages, lot: updatedLot };
}

export async function getStpLiveStatus() {
  const currentRow = await queryOne(
    `SELECT * FROM txn.prod_stp_lot
     WHERE tenant_id = $1
       AND production_started_at IS NOT NULL
       AND production_ended_at IS NULL
     ORDER BY production_started_at DESC
     LIMIT 1`,
    [config.tenantId]
  );

  const totals = await queryOne(
    `SELECT
       COALESCE(SUM(qty_mt), 0)::float8 AS total_mt,
       COALESCE(SUM(CASE WHEN production_ended_at IS NOT NULL THEN qty_mt ELSE 0 END), 0)::float8 AS completed_mt,
       COUNT(*) FILTER (WHERE production_started_at IS NOT NULL AND production_ended_at IS NULL)::int AS running_count,
       COUNT(*) FILTER (WHERE production_ended_at IS NOT NULL)::int AS completed_count
     FROM txn.prod_stp_lot
     WHERE tenant_id = $1 AND prod_date = CURRENT_DATE`,
    [config.tenantId]
  );

  const bathCount = await queryOne(
    `SELECT COUNT(*)::int AS n
     FROM txn.stp_bath_analysis b
     JOIN txn.prod_stp_lot l ON l.id = b.lot_id
     WHERE l.tenant_id = $1 AND l.prod_date = CURRENT_DATE`,
    [config.tenantId]
  );

  const chemCount = await queryOne(
    `SELECT COUNT(*)::int AS n
     FROM txn.stp_chemical_addition c
     WHERE c.tenant_id = $1 AND c.created_at::date = CURRENT_DATE`,
    [config.tenantId]
  );

  const stoppage = await queryOne(
    `SELECT COALESCE(
       SUM(
         EXTRACT(EPOCH FROM (COALESCE(to_time, now()) - from_time)) / 60.0
       ),
       0
     )::float8 AS minutes
     FROM txn.stoppage_entry
     WHERE tenant_id = $1
       AND process_code = 'STP'
       AND from_time::date = CURRENT_DATE`,
    [config.tenantId]
  );

  const startedKeys = await query(
    `SELECT work_order_no, work_order_line_no
     FROM txn.prod_stp_lot
     WHERE tenant_id = $1
       AND production_started_at IS NOT NULL
       AND (production_ended_at IS NULL OR prod_date = CURRENT_DATE)`,
    [config.tenantId]
  );
  const startedSet = new Set(
    startedKeys.map((r) => `${r.work_order_no}::${r.work_order_line_no ?? 1}`)
  );

  const orders = await listStpOrders('Released');
  const upcoming = [];
  for (const o of orders) {
    for (const line of o.lines ?? []) {
      const key = `${line.workOrderNo}::${line.lineNo ?? 1}`;
      if (startedSet.has(key)) continue;
      upcoming.push({
        workOrderNo: line.workOrderNo,
        lineNo: line.lineNo,
        customerCode: line.customerCode ?? o.customerCode,
        gradeCode: line.gradeCode ?? o.gradeCode,
        lotNo: line.lotNo ?? o.lotNo,
        coilNo: line.coilNo,
        size: line.size ?? o.size,
        qtyPieces: line.qtyPieces ?? o.qtyPieces,
        plannedQty: line.plannedQty ?? o.plannedQty,
        tubeShape: line.tubeShape,
        nextProcess: line.nextProcess,
        queuePosition: upcoming.length + 1,
      });
      if (upcoming.length >= 15) break;
    }
    if (upcoming.length >= 15) break;
  }

  return {
    shiftSummary: {
      totalProdMt: Number(totals?.total_mt ?? 0),
      completedMt: Number(totals?.completed_mt ?? 0),
      runningCount: Number(totals?.running_count ?? 0),
      completedCount: Number(totals?.completed_count ?? 0),
      bathAnalyses: Number(bathCount?.n ?? 0),
      chemicalAdditions: Number(chemCount?.n ?? 0),
      stoppageMin: Math.round(Number(stoppage?.minutes ?? 0)),
    },
    current: currentRow ? mapLot(currentRow) : null,
    upcoming,
  };
}

