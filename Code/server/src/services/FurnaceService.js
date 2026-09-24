import { query, queryOne, withTransaction } from '../db/pool';
import { config } from '../config';
import { strictTheoreticalTubeWeightKg } from './ParamBandService.js';

function parseSize(size) {
  if (!size) return {};
  if (typeof size === 'string') {
    try {
      return JSON.parse(size);
    } catch {
      return {};
    }
  }
  return size;
}

function formatSize(size) {
  const s = parseSize(size);
  const od = s.odMm ?? s.equivOdMm;
  const thk = s.thkMm;
  const len = s.lengthMm;
  if (od == null && thk == null && len == null) return null;
  return `${od ?? '—'}×${thk ?? '—'}×${len ?? '—'}`;
}

/** Derive MT from size × tube count — never invents missing dims. */
export function deriveFurnaceTotalMt(size, tubeCount) {
  const kg = strictTheoreticalTubeWeightKg(parseSize(size), tubeCount);
  if (kg == null) return null;
  return Math.round((kg / 1000) * 1000) / 1000;
}

function currentShiftRef() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

function resolveConsumption(input) {
  const pngA = input.pngA ?? input.pngConsumption ?? null;
  const nh3A = input.nh3A ?? input.nh3Consumption ?? null;
  return {
    pngA,
    pngB: input.pngB ?? null,
    pngC: input.pngC ?? null,
    nh3A,
    nh3B: input.nh3B ?? null,
    nh3C: input.nh3C ?? null,
    // keep legacy columns in sync with A for older reports
    pngConsumption: pngA,
    nh3Consumption: nh3A,
  };
}

function normalizeTotals(input, size) {
  const tubeCount = input.tubeCount ?? input.qtyNos ?? null;
  const totalNos = tubeCount;
  const computedMt = deriveFurnaceTotalMt(size ?? input.size, tubeCount);
  const totalMt = computedMt ?? input.totalMt ?? input.qtyMt ?? null;
  return { tubeCount, totalNos, totalMt, qtyNos: tubeCount, qtyMt: totalMt };
}

function mapAnn(row) {
  return {
    id: row.id,
    chargeNo: row.charge_no,
    furnaceCode: row.furnace_code,
    customerCode: row.customer_code,
    gradeCode: row.grade_code,
    workOrderNo: row.work_order_no,
    size: row.size,
    tubeCount: row.tube_count != null ? Number(row.tube_count) : null,
    htType: row.ht_type,
    zone1MinC: row.zone1_min_c != null ? Number(row.zone1_min_c) : null,
    zone1MaxC: row.zone1_max_c != null ? Number(row.zone1_max_c) : null,
    zone2MinC: row.zone2_min_c != null ? Number(row.zone2_min_c) : null,
    zone2MaxC: row.zone2_max_c != null ? Number(row.zone2_max_c) : null,
    zone3MinC: row.zone3_min_c != null ? Number(row.zone3_min_c) : null,
    zone3MaxC: row.zone3_max_c != null ? Number(row.zone3_max_c) : null,
    zone4MinC: row.zone4_min_c != null ? Number(row.zone4_min_c) : null,
    zone4MaxC: row.zone4_max_c != null ? Number(row.zone4_max_c) : null,
    zone5MinC: row.zone5_min_c != null ? Number(row.zone5_min_c) : null,
    zone5MaxC: row.zone5_max_c != null ? Number(row.zone5_max_c) : null,
    zone6MinC: row.zone6_min_c != null ? Number(row.zone6_min_c) : null,
    zone6MaxC: row.zone6_max_c != null ? Number(row.zone6_max_c) : null,
    lineSpeedMhr: row.line_speed_mhr != null ? Number(row.line_speed_mhr) : null,
    totalNos: row.total_nos != null ? Number(row.total_nos) : null,
    totalMt: row.total_mt != null ? Number(row.total_mt) : null,
    pngConsumption: row.png_a != null ? Number(row.png_a) : row.png_consumption != null ? Number(row.png_consumption) : null,
    nh3Consumption: row.nh3_a != null ? Number(row.nh3_a) : row.nh3_consumption != null ? Number(row.nh3_consumption) : null,
    pngA: row.png_a != null ? Number(row.png_a) : row.png_consumption != null ? Number(row.png_consumption) : null,
    pngB: row.png_b != null ? Number(row.png_b) : null,
    pngC: row.png_c != null ? Number(row.png_c) : null,
    nh3A: row.nh3_a != null ? Number(row.nh3_a) : row.nh3_consumption != null ? Number(row.nh3_consumption) : null,
    nh3B: row.nh3_b != null ? Number(row.nh3_b) : null,
    nh3C: row.nh3_c != null ? Number(row.nh3_c) : null,
    batchGapOk: row.batch_gap_ok,
    disposition: row.disposition,
    excursionDisposition: row.excursion_disposition ?? null,
    excursionNote: row.excursion_note ?? null,
    excursionClearedBy: row.excursion_cleared_by ?? null,
    excursionClearedAt: row.excursion_cleared_at ?? null,
    remarks: row.remarks,
    shiftRef: row.shift_ref,
    prodDate: row.prod_date,
    status: row.status,
    dataSource: row.data_source,
    materialLotId: row.material_lot_id,
    upstreamHandoffId: row.upstream_handoff_id,
    qtyNos: row.qty_nos != null ? Number(row.qty_nos) : row.tube_count != null ? Number(row.tube_count) : null,
    qtyMt: row.qty_mt != null ? Number(row.qty_mt) : row.total_mt != null ? Number(row.total_mt) : null,
    productionStartedAt: row.production_started_at ?? null,
    productionEndedAt: row.production_ended_at ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function listAnnRuns(filter = {}) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filter.status) {
    clauses.push(`status = $${i++}`);
    params.push(filter.status);
  }
  if (filter.furnaceCode) {
    clauses.push(`furnace_code = $${i++}`);
    params.push(filter.furnaceCode);
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
    `SELECT * FROM txn.prod_ann_run WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return rows.map(mapAnn);
}

export async function getAnnRun(id) {
  const row = await queryOne(`SELECT * FROM txn.prod_ann_run WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!row) return null;
  const gas = await query(
    `SELECT * FROM txn.ann_gas_log WHERE run_id = $1 AND tenant_id = $2 ORDER BY logged_at`,
    [id, config.tenantId]
  );
  return {
    ...mapAnn(row),
    gasLogs: gas.map((g) => ({
      id: g.id,
      loggedAt: g.logged_at,
      gasType: g.gas_type,
      gasParams: g.gas_params,
      dewPointC: g.dew_point_c != null ? Number(g.dew_point_c) : null,
      h2Pct: g.h2_pct != null ? Number(g.h2_pct) : null,
      o2Ppm: g.o2_ppm != null ? Number(g.o2_ppm) : null,
      changeoverTime: g.changeover_time,
      remarks: g.remarks,
    })),
  };
}

export async function createAnnRun(input) {
  const size = parseSize(input.size ?? {});
  const totals = normalizeTotals(input, size);
  const cons = resolveConsumption(input);

  const row = await queryOne(
    `INSERT INTO txn.prod_ann_run (
      tenant_id, charge_no, furnace_code, customer_code, grade_code, work_order_no, size,
      tube_count, ht_type,
      zone1_min_c, zone1_max_c, zone2_min_c, zone2_max_c, zone3_min_c, zone3_max_c,
      zone4_min_c, zone4_max_c, zone5_min_c, zone5_max_c, zone6_min_c, zone6_max_c,
      line_speed_mhr, total_nos, total_mt, png_consumption, nh3_consumption,
      png_a, png_b, png_c, nh3_a, nh3_b, nh3_c,
      batch_gap_ok, disposition, remarks, shift_ref, prod_date, status, data_source, created_by,
      material_lot_id, upstream_handoff_id, qty_nos, qty_mt
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
      $22,$23,$24,$25,$26,
      $27,$28,$29,$30,$31,$32,
      $33,$34,$35,$36,$37,$38,$39,$40,
      $41,$42,$43,$44
    ) RETURNING *`,
    [
      config.tenantId,
      input.chargeNo,
      input.furnaceCode,
      input.customerCode ?? null,
      input.gradeCode ?? null,
      input.workOrderNo ?? null,
      JSON.stringify(size),
      totals.tubeCount,
      input.htType ?? null,
      input.zone1MinC ?? null,
      input.zone1MaxC ?? null,
      input.zone2MinC ?? null,
      input.zone2MaxC ?? null,
      input.zone3MinC ?? null,
      input.zone3MaxC ?? null,
      input.zone4MinC ?? null,
      input.zone4MaxC ?? null,
      input.zone5MinC ?? null,
      input.zone5MaxC ?? null,
      input.zone6MinC ?? null,
      input.zone6MaxC ?? null,
      input.lineSpeedMhr ?? null,
      totals.totalNos,
      totals.totalMt,
      cons.pngConsumption,
      cons.nh3Consumption,
      cons.pngA,
      cons.pngB,
      cons.pngC,
      cons.nh3A,
      cons.nh3B,
      cons.nh3C,
      input.batchGapOk ?? null,
      input.disposition ?? null,
      input.remarks ?? null,
      input.shiftRef ?? currentShiftRef(),
      input.prodDate ?? new Date().toISOString().slice(0, 10),
      input.status ?? 'DRAFT',
      input.dataSource ?? 'MANUAL',
      input.createdBy ?? null,
      input.materialLotId ?? null,
      input.upstreamHandoffId ?? null,
      totals.qtyNos,
      totals.qtyMt,
    ]
  );
  try {
    const { activeShiftLogId } = await import('./handover/productionGuard.js');
    const sid = await activeShiftLogId(input.furnaceCode);
    if (sid && row?.id) {
      await query(`UPDATE txn.prod_ann_run SET shift_log_id = $1 WHERE id = $2 AND tenant_id = $3`, [
        sid,
        row.id,
        config.tenantId,
      ]);
      row.shift_log_id = sid;
    }
  } catch {
    /* best-effort */
  }
  return mapAnn(row);
}

export async function updateAnnRun(id, input) {
  const existing = await queryOne(`SELECT * FROM txn.prod_ann_run WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('Furnace production run not found');
  if (existing.status === 'APPROVED') throw new Error('Cannot edit APPROVED production run');

  const size =
    input.size != null ? parseSize(input.size) : parseSize(existing.size);
  const mergedForTotals = {
    tubeCount: input.tubeCount ?? input.qtyNos ?? existing.tube_count,
    qtyNos: input.qtyNos ?? input.tubeCount ?? existing.qty_nos,
    totalMt: input.totalMt ?? input.qtyMt,
    qtyMt: input.qtyMt ?? input.totalMt,
  };
  const totals = normalizeTotals(mergedForTotals, size);
  const cons = resolveConsumption({
    pngA: input.pngA,
    pngB: input.pngB,
    pngC: input.pngC,
    nh3A: input.nh3A,
    nh3B: input.nh3B,
    nh3C: input.nh3C,
    pngConsumption: input.pngConsumption,
    nh3Consumption: input.nh3Consumption,
  });
  const hasConsUpdate =
    input.pngA != null ||
    input.pngB != null ||
    input.pngC != null ||
    input.nh3A != null ||
    input.nh3B != null ||
    input.nh3C != null ||
    input.pngConsumption != null ||
    input.nh3Consumption != null;

  const row = await queryOne(
    `UPDATE txn.prod_ann_run SET
      furnace_code = COALESCE($3, furnace_code),
      customer_code = COALESCE($4, customer_code),
      grade_code = COALESCE($5, grade_code),
      work_order_no = COALESCE($6, work_order_no),
      size = COALESCE($7, size),
      tube_count = COALESCE($8, tube_count),
      ht_type = COALESCE($9, ht_type),
      zone1_min_c = COALESCE($10, zone1_min_c),
      zone1_max_c = COALESCE($11, zone1_max_c),
      zone2_min_c = COALESCE($12, zone2_min_c),
      zone2_max_c = COALESCE($13, zone2_max_c),
      zone3_min_c = COALESCE($14, zone3_min_c),
      zone3_max_c = COALESCE($15, zone3_max_c),
      zone4_min_c = COALESCE($16, zone4_min_c),
      zone4_max_c = COALESCE($17, zone4_max_c),
      zone5_min_c = COALESCE($18, zone5_min_c),
      zone5_max_c = COALESCE($19, zone5_max_c),
      zone6_min_c = COALESCE($20, zone6_min_c),
      zone6_max_c = COALESCE($21, zone6_max_c),
      line_speed_mhr = COALESCE($22, line_speed_mhr),
      total_nos = COALESCE($23, total_nos),
      total_mt = $24,
      png_consumption = COALESCE($25, png_consumption),
      nh3_consumption = COALESCE($26, nh3_consumption),
      png_a = COALESCE($27, png_a),
      png_b = COALESCE($28, png_b),
      png_c = COALESCE($29, png_c),
      nh3_a = COALESCE($30, nh3_a),
      nh3_b = COALESCE($31, nh3_b),
      nh3_c = COALESCE($32, nh3_c),
      batch_gap_ok = COALESCE($33, batch_gap_ok),
      disposition = COALESCE($34, disposition),
      remarks = COALESCE($35, remarks),
      shift_ref = COALESCE($36, shift_ref),
      prod_date = COALESCE($37, prod_date),
      data_source = COALESCE($38, data_source),
      material_lot_id = COALESCE($39, material_lot_id),
      upstream_handoff_id = COALESCE($40, upstream_handoff_id),
      qty_nos = COALESCE($41, qty_nos),
      qty_mt = $42,
      updated_at = now()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *`,
    [
      id,
      config.tenantId,
      input.furnaceCode ?? null,
      input.customerCode ?? null,
      input.gradeCode ?? null,
      input.workOrderNo ?? null,
      input.size != null ? JSON.stringify(size) : null,
      totals.tubeCount,
      input.htType ?? null,
      input.zone1MinC ?? null,
      input.zone1MaxC ?? null,
      input.zone2MinC ?? null,
      input.zone2MaxC ?? null,
      input.zone3MinC ?? null,
      input.zone3MaxC ?? null,
      input.zone4MinC ?? null,
      input.zone4MaxC ?? null,
      input.zone5MinC ?? null,
      input.zone5MaxC ?? null,
      input.zone6MinC ?? null,
      input.zone6MaxC ?? null,
      input.lineSpeedMhr ?? null,
      totals.totalNos,
      totals.totalMt,
      hasConsUpdate ? cons.pngConsumption : null,
      hasConsUpdate ? cons.nh3Consumption : null,
      hasConsUpdate ? cons.pngA : null,
      hasConsUpdate ? cons.pngB : null,
      hasConsUpdate ? cons.pngC : null,
      hasConsUpdate ? cons.nh3A : null,
      hasConsUpdate ? cons.nh3B : null,
      hasConsUpdate ? cons.nh3C : null,
      input.batchGapOk ?? null,
      input.disposition ?? null,
      input.remarks ?? null,
      input.shiftRef ?? null,
      input.prodDate ?? null,
      input.dataSource ?? 'MANUAL',
      input.materialLotId ?? null,
      input.upstreamHandoffId ?? null,
      totals.qtyNos,
      totals.qtyMt,
    ]
  );
  return mapAnn(row);
}

export async function setAnnStatus(id, status) {
  const row = await queryOne(
    `UPDATE txn.prod_ann_run SET status = $3, updated_at = now()
     WHERE id = $1 AND tenant_id = $2 RETURNING *`,
    [id, config.tenantId, status]
  );
  if (!row) throw new Error('Furnace production run not found');
  if (status === 'APPROVED') {
    try {
      const { enqueueFurWriteback } = await import('../erp/ErpWritebackService.js');
      await enqueueFurWriteback(id);
    } catch (err) {
      console.warn('[erp] FUR writeback enqueue failed:', err instanceof Error ? err.message : err);
    }
    try {
      const { publishFurMaterialLots } = await import('./GenealogyService.js');
      await publishFurMaterialLots(id);
    } catch (err) {
      console.warn('[genealogy] FUR publish failed:', err instanceof Error ? err.message : err);
    }
  }
  return mapAnn(row);
}

/** Operator Start: IDLE/PREPARING → RUNNING (sets production_started_at). */
export async function startFurnaceProduction(id) {
  const existing = await queryOne(`SELECT * FROM txn.prod_ann_run WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('Furnace production run not found');
  if (existing.status === 'APPROVED') throw new Error('Cannot start an APPROVED production run');
  if (existing.production_ended_at) throw new Error('Production run already ended');
  if (!existing.work_order_no) throw new Error('Work order required before Start');
  if (existing.production_started_at) {
    return mapAnn(existing);
  }

  const openStop = await queryOne(
    `SELECT id FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND process_code = 'FUR' AND source_id = $2 AND is_open = true
     LIMIT 1`,
    [config.tenantId, id]
  );
  if (openStop) throw new Error('End open stoppage before Start');

  const row = await queryOne(
    `UPDATE txn.prod_ann_run
     SET production_started_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, config.tenantId]
  );
  return mapAnn(row);
}

/** Operator End: RUNNING → COMPLETE (sets production_ended_at; does not Approve). */
export async function endFurnaceProduction(id) {
  const existing = await queryOne(`SELECT * FROM txn.prod_ann_run WHERE id = $1 AND tenant_id = $2`, [
    id,
    config.tenantId,
  ]);
  if (!existing) throw new Error('Furnace production run not found');
  if (existing.status === 'APPROVED') throw new Error('Production run already approved');
  if (!existing.production_started_at) throw new Error('Start production before End');
  if (existing.production_ended_at) {
    return mapAnn(existing);
  }

  return withTransaction(async (client) => {
    try {
      const { closeProcessStoppage } = await import('./ProcessStoppageService.js');
      await closeProcessStoppage('FUR', id, client);
    } catch {
      /* no open stoppage is fine */
    }

    const row = await queryOne(
      `UPDATE txn.prod_ann_run
       SET production_ended_at = now(), updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, config.tenantId],
      client
    );
    return mapAnn(row);
  });
}

export async function addGasLog(input) {
  const row = await queryOne(
    `INSERT INTO txn.ann_gas_log (
      tenant_id, run_id, logged_at, gas_type, gas_params, dew_point_c, h2_pct, o2_ppm, changeover_time, remarks
    ) VALUES ($1,$2,COALESCE($3::timestamptz, now()),$4,$5,$6,$7,$8,$9::timestamptz,$10) RETURNING *`,
    [
      config.tenantId,
      input.runId,
      input.loggedAt ?? null,
      input.gasType ?? null,
      JSON.stringify(input.gasParams ?? {}),
      input.dewPointC ?? null,
      input.h2Pct ?? null,
      input.o2Ppm ?? null,
      input.changeoverTime ?? null,
      input.remarks ?? null,
    ]
  );
  return row;
}

function mapMachine(row) {
  return {
    machineCode: row.machine_code,
    label: row.label,
    processCode: row.process_code,
    gasType: row.gas_type ?? null,
    furnaceType: row.furnace_type ?? 'RHF',
    enabled: row.enabled !== false,
    displayOrder: row.display_order != null ? Number(row.display_order) : 100,
    machine_code: row.machine_code,
  };
}

export async function listFurnaceMachines() {
  const rows = await query(
    `SELECT machine_code, label, process_code, gas_type, furnace_type, enabled, display_order
     FROM master.machine
     WHERE tenant_id = $1 AND process_code = 'FUR'
     ORDER BY COALESCE(display_order, 100), machine_code`,
    [config.tenantId]
  );
  return rows.map(mapMachine);
}

function zoneSummary(lot) {
  if (!lot) return [];
  return [1, 2, 3, 4, 5, 6].map((z) => {
    const min = lot[`zone${z}_min_c`] != null ? Number(lot[`zone${z}_min_c`]) : null;
    const max = lot[`zone${z}_max_c`] != null ? Number(lot[`zone${z}_max_c`]) : null;
    return { zone: z, minC: min, maxC: max };
  });
}

function deriveBoardStatus(lot, openStoppage) {
  if (openStoppage) return 'STOPPAGE';
  if (!lot) return 'IDLE';
  if (lot.status === 'APPROVED' || lot.production_ended_at) return 'COMPLETE';
  if (lot.status === 'HOLD') return 'STOPPAGE';
  if (lot.production_started_at && !lot.production_ended_at) return 'RUNNING';
  if (lot.work_order_no) return 'PREPARING';
  return 'IDLE';
}

/**
 * Per-furnace operator board: one row per FUR machine with derived status.
 */
export async function getFurnaceBoard() {
  const machines = await listFurnaceMachines();
  const lots = await query(
    `SELECT DISTINCT ON (furnace_code) *
     FROM txn.prod_ann_run
     WHERE tenant_id = $1
     ORDER BY furnace_code,
       CASE
         WHEN production_ended_at IS NULL AND status IN ('DRAFT','SUBMITTED','HOLD') THEN 0
         ELSE 1
       END,
       created_at DESC`,
    [config.tenantId]
  );
  const lotByFurnace = new Map(lots.map((r) => [r.furnace_code, r]));
  const lotIds = lots.map((r) => r.id).filter(Boolean);
  let stoppages = [];
  if (lotIds.length) {
    stoppages = await query(
      `SELECT source_id, stoppage_code, from_time, reason, is_open
       FROM txn.stoppage_entry
       WHERE tenant_id = $1 AND process_code = 'FUR' AND is_open = true
         AND source_id = ANY($2::uuid[])`,
      [config.tenantId, lotIds]
    );
  }
  const stopByLot = new Map(stoppages.map((s) => [String(s.source_id), s]));

  return machines
    .filter((m) => m.enabled !== false)
    .map((m) => {
      const lot = lotByFurnace.get(m.machineCode) ?? null;
      const openStoppage = lot ? stopByLot.get(String(lot.id)) ?? null : null;
      const boardStatus = deriveBoardStatus(lot, openStoppage);
      const sizeLabel = lot ? formatSize(lot.size) : null;
      return {
        furnaceCode: m.machineCode,
        label: m.label,
        furnaceType: m.furnaceType,
        gasType: m.gasType,
        displayOrder: m.displayOrder,
        status: boardStatus,
        lotId: lot?.id ?? null,
        lotStatus: lot?.status ?? null,
        chargeNo: lot?.charge_no ?? null,
        runningOrder: lot
          ? {
              workOrderNo: lot.work_order_no ?? null,
              customerCode: lot.customer_code ?? null,
              gradeCode: lot.grade_code ?? null,
              size: sizeLabel,
              sizeJson: parseSize(lot.size),
              htType: lot.ht_type ?? null,
            }
          : null,
        lineSpeedMhr: lot?.line_speed_mhr != null ? Number(lot.line_speed_mhr) : null,
        zones: zoneSummary(lot),
        zonesFilled: zoneSummary(lot).filter((z) => z.minC != null || z.maxC != null).length,
        zonesTotal: 6,
        lastSavedAt: lot?.created_at ?? null,
        productionStartedAt: lot?.production_started_at ?? null,
        productionEndedAt: lot?.production_ended_at ?? null,
        tubeCount:
          lot?.tube_count != null
            ? Number(lot.tube_count)
            : lot?.qty_nos != null
              ? Number(lot.qty_nos)
              : null,
        totalMt:
          lot?.total_mt != null
            ? Number(lot.total_mt)
            : lot?.qty_mt != null
              ? Number(lot.qty_mt)
              : null,
        openStoppage: openStoppage
          ? {
              code: openStoppage.stoppage_code,
              fromTime: openStoppage.from_time,
              reason: openStoppage.reason ?? null,
              sourceId: lot?.id ?? null,
            }
          : null,
      };
    });
}

/** Cross-furnace open stoppages for FUR Stop hub. */
export async function listOpenFurnaceStoppages() {
  const rows = await query(
    `SELECT s.id, s.source_id, s.stoppage_code, s.from_time, s.reason, s.mill_code,
            r.furnace_code, r.charge_no, r.work_order_no
     FROM txn.stoppage_entry s
     LEFT JOIN txn.prod_ann_run r ON r.id = s.source_id AND r.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1 AND s.process_code = 'FUR' AND s.is_open = true
     ORDER BY s.from_time DESC`,
    [config.tenantId]
  );
  return rows.map((s) => ({
    id: s.id,
    sourceId: s.source_id,
    stoppageCode: s.stoppage_code,
    fromTime: s.from_time,
    reason: s.reason ?? null,
    millCode: s.mill_code ?? null,
    furnaceCode: s.furnace_code ?? s.mill_code ?? null,
    chargeNo: s.charge_no ?? null,
    workOrderNo: s.work_order_no ?? null,
  }));
}

/** Furnace stoppage history (open + closed) for History tab. */
export async function listFurnaceStoppageHistory(filter = {}) {
  const clauses = [`s.tenant_id = $1`, `s.process_code = 'FUR'`];
  const params = [config.tenantId];
  let i = 2;
  if (filter.furnaceCode) {
    clauses.push(`COALESCE(r.furnace_code, s.mill_code) = $${i++}`);
    params.push(filter.furnaceCode);
  }
  if (filter.fromDate) {
    clauses.push(`s.from_time >= $${i++}::timestamptz`);
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    clauses.push(`s.from_time <= $${i++}::timestamptz`);
    params.push(filter.toDate);
  }
  if (filter.openOnly === true) {
    clauses.push(`s.is_open = true`);
  } else if (filter.openOnly === false) {
    clauses.push(`s.is_open = false`);
  }
  const rows = await query(
    `SELECT s.id, s.source_id, s.stoppage_code, s.from_time, s.to_time, s.is_open, s.reason, s.mill_code,
            r.furnace_code, r.charge_no, r.work_order_no
     FROM txn.stoppage_entry s
     LEFT JOIN txn.prod_ann_run r ON r.id = s.source_id AND r.tenant_id = s.tenant_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY s.from_time DESC
     LIMIT 200`,
    params
  );
  return rows.map((s) => ({
    id: s.id,
    sourceId: s.source_id,
    stoppageCode: s.stoppage_code,
    fromTime: s.from_time,
    toTime: s.to_time ?? null,
    isOpen: s.is_open === true || s.is_open === 1 || s.is_open === 't' || s.is_open === 'true',
    reason: s.reason ?? null,
    millCode: s.mill_code ?? null,
    furnaceCode: s.furnace_code ?? s.mill_code ?? null,
    chargeNo: s.charge_no ?? null,
    workOrderNo: s.work_order_no ?? null,
  }));
}

/** Gas logs across furnaces for History tab. */
export async function listFurnaceGasLogs(filter = {}) {
  const clauses = ['g.tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filter.furnaceCode) {
    clauses.push(`r.furnace_code = $${i++}`);
    params.push(filter.furnaceCode);
  }
  if (filter.fromDate) {
    clauses.push(`g.logged_at >= $${i++}::timestamptz`);
    params.push(filter.fromDate);
  }
  if (filter.toDate) {
    clauses.push(`g.logged_at <= $${i++}::timestamptz`);
    params.push(filter.toDate);
  }
  const rows = await query(
    `SELECT g.*, r.furnace_code, r.charge_no, r.work_order_no
     FROM txn.ann_gas_log g
     JOIN txn.prod_ann_run r ON r.id = g.run_id AND r.tenant_id = g.tenant_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY g.logged_at DESC
     LIMIT 200`,
    params
  );
  return rows.map((g) => ({
    id: g.id,
    runId: g.run_id,
    loggedAt: g.logged_at,
    gasType: g.gas_type,
    gasParams: g.gas_params,
    dewPointC: g.dew_point_c != null ? Number(g.dew_point_c) : null,
    h2Pct: g.h2_pct != null ? Number(g.h2_pct) : null,
    o2Ppm: g.o2_ppm != null ? Number(g.o2_ppm) : null,
    changeoverTime: g.changeover_time,
    remarks: g.remarks,
    furnaceCode: g.furnace_code,
    chargeNo: g.charge_no,
    workOrderNo: g.work_order_no,
  }));
}

/**
 * Assign a released ERP WO to a furnace as a DRAFT prod_ann_run.
 */
export async function assignFurnaceOrder(furnaceCode, input = {}) {
  const machine = (await listFurnaceMachines()).find((m) => m.machineCode === furnaceCode);
  if (!machine) throw new Error(`Unknown furnace ${furnaceCode}`);
  if (machine.enabled === false) throw new Error(`Furnace ${furnaceCode} is disabled`);

  const workOrderNo = String(input.workOrderNo ?? '').trim();
  if (!workOrderNo) throw new Error('workOrderNo is required');

  const open = await queryOne(
    `SELECT id, charge_no, status FROM txn.prod_ann_run
     WHERE tenant_id = $1 AND furnace_code = $2
       AND status IN ('DRAFT','SUBMITTED','HOLD')
       AND production_ended_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, furnaceCode]
  );
  if (open) {
    throw new Error(`Furnace ${furnaceCode} already has active lot ${open.charge_no} (${open.status})`);
  }

  const order = await queryOne(
    `SELECT work_order_no, customer_code, grade_code, size, qty_pieces, planned_qty, lot_no
     FROM erp.released_order
     WHERE tenant_id = $1 AND work_order_no = $2`,
    [config.tenantId, workOrderNo]
  );

  let size = input.size ?? order?.size ?? {};
  size = parseSize(size);

  const gradeCode = input.gradeCode ?? order?.grade_code ?? null;
  const recipe = await getFurnaceRecipe({ gradeCode, furnaceCode });
  const tubeCount = input.tubeCount ?? order?.qty_pieces ?? null;
  const totalMt = deriveFurnaceTotalMt(size, tubeCount) ?? input.totalMt ?? null;
  const lengthMm = Number(size?.lengthMm);
  const batchGapOk =
    input.batchGapOk ??
    !(Number.isFinite(lengthMm) && lengthMm > 0 && lengthMm < 6000);

  const chargeNo =
    input.chargeNo ??
    `FUR-${furnaceCode.replace(/[^A-Z0-9]/gi, '')}-${Date.now().toString(36).toUpperCase()}`;

  return createAnnRun({
    chargeNo,
    furnaceCode,
    workOrderNo,
    customerCode: input.customerCode ?? order?.customer_code ?? null,
    gradeCode,
    size,
    tubeCount,
    totalMt,
    htType: input.htType ?? recipe?.htType ?? null,
    shiftRef: input.shiftRef ?? currentShiftRef(),
    prodDate: input.prodDate ?? new Date().toISOString().slice(0, 10),
    status: 'DRAFT',
    dataSource: 'MANUAL',
    materialLotId: input.materialLotId ?? null,
    batchGapOk,
  });
}

export async function getFurnaceRecipe({ gradeCode, furnaceCode } = {}) {
  if (!gradeCode && !furnaceCode) return null;
  const row = await queryOne(
    `SELECT grade_code, furnace_code, soaking_spec_c, speed_spec_m_hr, ht_type
     FROM master.fur_zone_recipe
     WHERE tenant_id = $1
       AND ($2::text IS NULL OR grade_code = $2)
       AND ($3::text IS NULL OR furnace_code = $3)
     ORDER BY
       CASE WHEN grade_code = $2 AND furnace_code = $3 THEN 0
            WHEN grade_code = $2 THEN 1
            WHEN furnace_code = $3 THEN 2
            ELSE 3 END
     LIMIT 1`,
    [config.tenantId, gradeCode ?? null, furnaceCode ?? null]
  );
  if (!row) return null;
  return {
    gradeCode: row.grade_code,
    furnaceCode: row.furnace_code,
    soakingSpecC: row.soaking_spec_c != null ? Number(row.soaking_spec_c) : null,
    speedSpecMhr: row.speed_spec_m_hr != null ? Number(row.speed_spec_m_hr) : null,
    htType: row.ht_type ?? null,
  };
}

export async function resolveFurnaceMaster(input = {}) {
  const recipe = await getFurnaceRecipe({
    gradeCode: input.gradeCode,
    furnaceCode: input.furnaceCode,
  });
  if (!recipe) return {};
  return {
    soakingSpecC: recipe.soakingSpecC,
    speedSpecMhr: recipe.speedSpecMhr,
    htType: recipe.htType,
  };
}

const SOAK_TOLERANCE_C = 10;

/** True when any zone min/max reading is outside soak recipe ±10°C. */
export function hasZoneExcursion(run, soakingSpecC) {
  const spec = Number(soakingSpecC);
  if (!Number.isFinite(spec)) return false;
  const lo = spec - SOAK_TOLERANCE_C;
  const hi = spec + SOAK_TOLERANCE_C;
  for (let i = 1; i <= 6; i++) {
    const minRaw = run[`zone${i}MinC`];
    const maxRaw = run[`zone${i}MaxC`];
    const min = minRaw == null || minRaw === '' ? NaN : Number(minRaw);
    const max = maxRaw == null || maxRaw === '' ? NaN : Number(maxRaw);
    if (Number.isFinite(min) && (min < lo || min > hi)) return true;
    if (Number.isFinite(max) && (max < lo || max > hi)) return true;
  }
  return false;
}

export async function clearFurnaceExcursion(id, { disposition, note, clearedBy }) {
  const allowed = ['ACCEPT_WITH_NOTE', 'QUARANTINE', 'ACCEPT', 'REJECT'];
  if (!allowed.includes(String(disposition))) {
    throw new Error('disposition must be ACCEPT_WITH_NOTE or QUARANTINE');
  }
  const row = await queryOne(
    `UPDATE txn.prod_ann_run SET
       excursion_disposition = $2,
       excursion_note = $3,
       excursion_cleared_by = $4,
       excursion_cleared_at = now(),
       updated_at = now()
     WHERE id = $1 AND tenant_id = $5
     RETURNING *`,
    [id, disposition, note ?? null, clearedBy ?? null, config.tenantId]
  );
  return row ? mapAnn(row) : null;
}

export async function assertFurnaceApprovable(run) {
  const master = await resolveFurnaceMaster(run);
  if (hasZoneExcursion(run, master.soakingSpecC) && !run.excursionDisposition) {
    const err = new Error('Zone excursion requires Machine Head disposition before approve');
    err.status = 422;
    err.issues = [
      {
        field: 'excursionDisposition',
        message: 'Clear zone excursion (ACCEPT_WITH_NOTE or QUARANTINE)',
        severity: 'ERROR',
      },
    ];
    throw err;
  }
}

function mapDailyConsumption(row) {
  if (!row) return null;
  return {
    id: row.id,
    furnaceCode: row.furnace_code,
    prodDate: row.prod_date,
    shiftRef: row.shift_ref ?? null,
    pngA: row.png_a != null ? Number(row.png_a) : null,
    pngB: row.png_b != null ? Number(row.png_b) : null,
    pngC: row.png_c != null ? Number(row.png_c) : null,
    nh3A: row.nh3_a != null ? Number(row.nh3_a) : null,
    nh3B: row.nh3_b != null ? Number(row.nh3_b) : null,
    nh3C: row.nh3_c != null ? Number(row.nh3_c) : null,
    source: row.source ?? 'MANUAL',
    updatedAt: row.updated_at ?? null,
  };
}

/** Independent furnace+date consumption (not tied to a production run). */
export async function getFurnaceDailyConsumption(furnaceCode, prodDate) {
  const row = await queryOne(
    `SELECT * FROM txn.fur_daily_consumption
     WHERE tenant_id = $1 AND furnace_code = $2 AND prod_date = $3::date`,
    [config.tenantId, furnaceCode, prodDate]
  );
  return mapDailyConsumption(row);
}

export async function upsertFurnaceDailyConsumption(input = {}) {
  const furnaceCode = String(input.furnaceCode ?? '').trim();
  const prodDate = String(input.prodDate ?? '').slice(0, 10);
  if (!furnaceCode) throw new Error('furnaceCode required');
  if (!prodDate) throw new Error('prodDate required');
  const cons = resolveConsumption(input);
  const row = await queryOne(
    `INSERT INTO txn.fur_daily_consumption (
       tenant_id, furnace_code, prod_date, shift_ref,
       png_a, png_b, png_c, nh3_a, nh3_b, nh3_c, source, updated_at
     ) VALUES (
       $1, $2, $3::date, $4,
       $5, $6, $7, $8, $9, $10, 'MANUAL', now()
     )
     ON CONFLICT (tenant_id, furnace_code, prod_date) DO UPDATE SET
       shift_ref = COALESCE(EXCLUDED.shift_ref, txn.fur_daily_consumption.shift_ref),
       png_a = EXCLUDED.png_a,
       png_b = EXCLUDED.png_b,
       png_c = EXCLUDED.png_c,
       nh3_a = EXCLUDED.nh3_a,
       nh3_b = EXCLUDED.nh3_b,
       nh3_c = EXCLUDED.nh3_c,
       source = 'MANUAL',
       updated_at = now()
     RETURNING *`,
    [
      config.tenantId,
      furnaceCode,
      prodDate,
      input.shiftRef ? String(input.shiftRef) : null,
      cons.pngA,
      cons.pngB,
      cons.pngC,
      cons.nh3A,
      cons.nh3B,
      cons.nh3C,
    ]
  );
  return mapDailyConsumption(row);
}
