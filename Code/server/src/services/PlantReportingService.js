import { query } from '../db/pool';
import { config } from '../config';
import { listShifts } from './ShiftHandoverService';
import { getMachineHeadDashboard } from './MhReviewService';

const TENANT = () => config.tenantId;

async function safeQuery(sql, params, fallback = []) {
  try {
    return await query(sql, params);
  } catch {
    return fallback;
  }
}

function windowStart(windowDays) {
  const days = Math.max(1, Math.min(90, Number(windowDays) || 7));
  return { days, since: new Date(Date.now() - days * 86400000) };
}

/**
 * Plant-wide dashboard — never filtered by machineAccess.
 */
export async function getPlantHeadDashboard(windowDays = 7) {
  const tenant = TENANT();
  const { days, since } = windowStart(windowDays);
  const live = await getMachineHeadDashboard({ roles: ['PLANT_HEAD'] });

  const tmProd = await safeQuery(
    `SELECT
       COALESCE(SUM(total_prime_mt),0)::float AS prime_mt,
       COALESCE(SUM(raw_material_mt),0)::float AS raw_mt,
       COALESCE(SUM(total_scrap_mt),0)::float AS scrap_mt,
       COALESCE(AVG(yield_pct),0)::float AS avg_yield,
       COUNT(*)::int AS runs
     FROM txn.prod_tm_run
     WHERE tenant_id = $1 AND COALESCE(created_at, time_from) >= $2`,
    [tenant, since]
  );

  const furProd = await safeQuery(
    `SELECT COUNT(*)::int AS runs,
            COALESCE(SUM(COALESCE(total_mt, 0)),0)::float AS output_mt
     FROM txn.prod_ann_run
     WHERE tenant_id = $1 AND COALESCE(updated_at, created_at) >= $2`,
    [tenant, since]
  );

  const stpProd = await safeQuery(
    `SELECT COUNT(*)::int AS lots
     FROM txn.prod_stp_lot
     WHERE tenant_id = $1 AND COALESCE(updated_at, created_at) >= $2`,
    [tenant, since]
  );

  const drwProd = await safeQuery(
    `SELECT COUNT(*)::int AS lots
     FROM txn.prod_db_lot
     WHERE tenant_id = $1 AND COALESCE(created_at, now()) >= $2`,
    [tenant, since]
  );

  const downtime = await safeQuery(
    `SELECT
       COALESCE(SUM(COALESCE(duration_min, EXTRACT(EPOCH FROM (COALESCE(to_time, now()) - from_time))/60.0)),0)::float AS total_min,
       COUNT(*)::int AS events,
       COUNT(*) FILTER (WHERE is_open)::int AS open_events
     FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND from_time >= $2`,
    [tenant, since]
  );

  const topStoppages = await safeQuery(
    `SELECT COALESCE(s.stoppage_code, 'UNKNOWN') AS code,
            COALESCE(m.label, s.stoppage_code, 'Unknown') AS label,
            COUNT(*)::int AS count,
            COALESCE(SUM(COALESCE(s.duration_min, 0)),0)::float AS minutes
     FROM txn.stoppage_entry s
     LEFT JOIN master.stoppage_code m ON m.code = s.stoppage_code
     WHERE s.tenant_id = $1 AND s.from_time >= $2
     GROUP BY 1, 2
     ORDER BY minutes DESC NULLS LAST
     LIMIT 10`,
    [tenant, since]
  );

  const topDefects = await safeQuery(
    `SELECT COALESCE(d.defect_code, 'UNKNOWN') AS code,
            COALESCE(m.label, d.defect_code, 'Unknown') AS label,
            COUNT(*)::int AS count,
            COALESCE(SUM(COALESCE(d.quantity_mt, 0)),0)::float AS mt
     FROM txn.tm_defect d
     LEFT JOIN master.defect_code m ON m.code = d.defect_code
     WHERE d.tenant_id = $1 AND d.created_at >= $2
     GROUP BY 1, 2
     ORDER BY count DESC
     LIMIT 10`,
    [tenant, since]
  );

  const orderBacklog = await safeQuery(
    `SELECT COUNT(*)::int AS n
     FROM erp.released_order
     WHERE tenant_id = $1 AND UPPER(COALESCE(status,'')) NOT IN ('CLOSED','COMPLETE','COMPLETED','CANCELLED')`,
    [tenant]
  );

  const machines = await safeQuery(
    `SELECT machine_code, label, process_code FROM master.machine
     WHERE tenant_id = $1 ORDER BY process_code, machine_code`,
    [tenant]
  );

  const prime = Number(tmProd[0]?.prime_mt ?? 0);
  const raw = Number(tmProd[0]?.raw_mt ?? 0);
  const scrap = Number(tmProd[0]?.scrap_mt ?? 0);
  const yieldPct = raw > 0 ? Math.round((prime / raw) * 1000) / 10 : Number(tmProd[0]?.avg_yield ?? 0);
  const downtimeMin = Number(downtime[0]?.total_min ?? 0);
  const plannedMin = days * 24 * 60;
  const availability = plannedMin > 0 ? Math.max(0, Math.min(100, Math.round((1 - downtimeMin / plannedMin) * 1000) / 10)) : 100;
  const performance = 85;
  const quality = yieldPct || 90;
  const oee = Math.round((availability * performance * quality) / 10000 * 10) / 10;

  const byProcessLive = live?.byProcess ?? {};
  let running = 0;
  let stopped = 0;
  let open = 0;
  for (const p of Object.values(byProcessLive)) {
    running += Number(p.running ?? 0);
    open += Number(p.open ?? 0);
    stopped += Number(p.hold ?? 0);
  }

  return {
    windowDays: days,
    kpi: {
      todayMt: prime,
      rawMt: raw,
      scrapMt: scrap,
      yieldPct,
      oee,
      availability,
      performance,
      quality,
      downtimeMin,
      openStoppages: Number(downtime[0]?.open_events ?? 0),
      backlogOrders: Number(orderBacklog[0]?.n ?? 0),
      machinesTotal: machines.length,
      machinesRunning: running,
      machinesOpen: open,
      machinesHold: stopped,
    },
    byProcess: {
      TM: {
        ...byProcessLive.TM,
        primeMt: prime,
        rawMt: raw,
        scrapMt: scrap,
        yieldPct,
        runs: Number(tmProd[0]?.runs ?? 0),
      },
      FUR: {
        ...byProcessLive.FUR,
        outputMt: Number(furProd[0]?.output_mt ?? 0),
        runs: Number(furProd[0]?.runs ?? 0),
      },
      STP: { ...byProcessLive.STP, lots: Number(stpProd[0]?.lots ?? 0) },
      DRW: { ...byProcessLive.DRW, lots: Number(drwProd[0]?.lots ?? 0) },
      SWG: byProcessLive.SWG ?? { open: 0, running: 0, submitted: 0, hold: 0 },
    },
    topDefects: topDefects.map((r) => ({
      code: r.code,
      label: r.label,
      count: Number(r.count),
      mt: Number(r.mt),
    })),
    topStoppages: topStoppages.map((r) => ({
      code: r.code,
      label: r.label,
      count: Number(r.count),
      minutes: Number(r.minutes),
    })),
    machines: machines.map((m) => ({
      machineCode: m.machine_code,
      label: m.label,
      processCode: m.process_code,
    })),
    alerts: buildAlerts({
      yieldPct,
      oee,
      openStoppages: Number(downtime[0]?.open_events ?? 0),
      backlog: Number(orderBacklog[0]?.n ?? 0),
      holds: stopped,
    }),
  };
}

function buildAlerts({ yieldPct, oee, openStoppages, backlog, holds }) {
  const alerts = [];
  if (yieldPct > 0 && yieldPct < 90) {
    alerts.push({ severity: 'warn', code: 'YIELD_LOW', message: `Plant yield ${yieldPct}% below 90% target` });
  }
  if (oee < 70) {
    alerts.push({ severity: 'warn', code: 'OEE_LOW', message: `Plant OEE ${oee}% below 70%` });
  }
  if (openStoppages > 0) {
    alerts.push({ severity: 'info', code: 'OPEN_STOPPAGES', message: `${openStoppages} open stoppage(s)` });
  }
  if (holds > 0) {
    alerts.push({ severity: 'warn', code: 'HOLDS', message: `${holds} lot(s)/run(s) on hold` });
  }
  if (backlog > 20) {
    alerts.push({ severity: 'info', code: 'BACKLOG', message: `${backlog} open ERP orders` });
  }
  return alerts;
}

export async function getPlantHeadBacklog() {
  const live = await getMachineHeadDashboard({ roles: ['PLANT_HEAD'] });
  const byProcess = live?.byProcess ?? {};
  const processes = Object.entries(byProcess).map(([process, s]) => ({
    process,
    open: Number(s.open ?? 0),
    running: Number(s.running ?? 0),
    submitted: Number(s.submitted ?? 0),
    hold: Number(s.hold ?? 0),
  }));
  const totals = processes.reduce(
    (acc, p) => ({
      open: acc.open + p.open,
      running: acc.running + p.running,
      submitted: acc.submitted + p.submitted,
      hold: acc.hold + p.hold,
    }),
    { open: 0, running: 0, submitted: 0, hold: 0 }
  );

  const orders = await safeQuery(
    `SELECT work_order_no, status, customer_code, grade_code, lot_no, planned_qty, qty_pieces, mill_code, updated_at
     FROM erp.released_order
     WHERE tenant_id = $1 AND UPPER(COALESCE(status,'')) NOT IN ('CLOSED','COMPLETE','COMPLETED','CANCELLED')
     ORDER BY updated_at DESC NULLS LAST, work_order_no
     LIMIT 100`,
    [TENANT()]
  );

  return {
    totals,
    byProcess: processes,
    orders: orders.map((o) => ({
      workOrderNo: o.work_order_no,
      status: o.status,
      customerCode: o.customer_code,
      gradeCode: o.grade_code,
      lotNo: o.lot_no,
      qty: o.planned_qty != null ? Number(o.planned_qty) : null,
      qtyPieces: o.qty_pieces != null ? Number(o.qty_pieces) : null,
      millCode: o.mill_code,
      updatedAt: o.updated_at,
    })),
  };
}

export async function getManagementDashboard(period = '7d') {
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const dash = await getPlantHeadDashboard(days);
  return {
    period: `${days}d`,
    totals: {
      productionMt: dash.kpi.todayMt,
      yieldPct: dash.kpi.yieldPct,
      oee: dash.kpi.oee,
      downtimeMin: dash.kpi.downtimeMin,
      scrapMt: dash.kpi.scrapMt,
      backlogOrders: dash.kpi.backlogOrders,
    },
    byProcess: dash.byProcess,
    topDefects: dash.topDefects,
    topStoppages: dash.topStoppages,
  };
}

export async function getDailyReport(dateStr) {
  const tenant = TENANT();
  const day = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + 86400000);

  const tm = await safeQuery(
    `SELECT mill_code AS machine_code,
            COUNT(*)::int AS runs,
            COALESCE(SUM(total_prime_mt),0)::float AS prime_mt,
            COALESCE(SUM(raw_material_mt),0)::float AS raw_mt,
            COALESCE(AVG(yield_pct),0)::float AS yield_pct
     FROM txn.prod_tm_run
     WHERE tenant_id = $1 AND COALESCE(created_at, time_from) >= $2 AND COALESCE(created_at, time_from) < $3
     GROUP BY mill_code`,
    [tenant, start, end]
  );

  const fur = await safeQuery(
    `SELECT furnace_code AS machine_code, COUNT(*)::int AS runs
     FROM txn.prod_ann_run
     WHERE tenant_id = $1 AND COALESCE(updated_at, created_at) >= $2 AND COALESCE(updated_at, created_at) < $3
     GROUP BY furnace_code`,
    [tenant, start, end]
  );

  const stoppages = await safeQuery(
    `SELECT COALESCE(mill_code,'—') AS machine_code, COUNT(*)::int AS events,
            COALESCE(SUM(COALESCE(duration_min,0)),0)::float AS minutes
     FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND from_time >= $2 AND from_time < $3
     GROUP BY 1`,
    [tenant, start, end]
  );

  return {
    date: start.toISOString().slice(0, 10),
    tm: tm.map((r) => ({
      machineCode: r.machine_code,
      runs: Number(r.runs),
      primeMt: Number(r.prime_mt),
      rawMt: Number(r.raw_mt),
      yieldPct: Number(r.yield_pct),
    })),
    furnace: fur.map((r) => ({ machineCode: r.machine_code, runs: Number(r.runs) })),
    stoppages: stoppages.map((r) => ({
      machineCode: r.machine_code,
      events: Number(r.events),
      minutes: Number(r.minutes),
    })),
  };
}

/**
 * Drilldown hierarchy: plant → process → machine → shift/records.
 */
export async function getPlantHeadDrilldown({ metric = 'production', process, machine, shift } = {}) {
  const tenant = TENANT();
  const { since } = windowStart(14);

  if (!process) {
    const rows = [
      { process: 'TM', label: 'Tube Mill' },
      { process: 'FUR', label: 'Furnace' },
      { process: 'STP', label: 'STP' },
      { process: 'DRW', label: 'Draw Bench' },
      { process: 'SWG', label: 'Swaging' },
    ];
    const live = await getMachineHeadDashboard({ roles: ['PLANT_HEAD'] });
    return {
      level: 'process',
      metric,
      items: rows.map((r) => {
        const s = live?.byProcess?.[r.process] ?? {};
        return {
          id: r.process,
          label: r.label,
          open: Number(s.open ?? 0),
          running: Number(s.running ?? 0),
          submitted: Number(s.submitted ?? 0),
          hold: Number(s.hold ?? 0),
        };
      }),
    };
  }

  if (!machine) {
    const machines = await safeQuery(
      `SELECT machine_code, label FROM master.machine
       WHERE tenant_id = $1 AND process_code = $2
       ORDER BY machine_code`,
      [tenant, process]
    );
    return {
      level: 'machine',
      metric,
      process,
      items: machines.map((m) => ({
        id: m.machine_code,
        label: m.label || m.machine_code,
      })),
    };
  }

  if (!shift) {
    // Record list for machine
    let records = [];
    if (process === 'TM') {
      records = await safeQuery(
        `SELECT id, run_no AS label, status, work_order_no, total_prime_mt AS mt, created_at
         FROM txn.prod_tm_run
         WHERE tenant_id = $1 AND mill_code = $2 AND COALESCE(created_at, time_from) >= $3
         ORDER BY created_at DESC LIMIT 50`,
        [tenant, machine, since]
      );
    } else if (process === 'FUR') {
      records = await safeQuery(
        `SELECT id, COALESCE(charge_no, work_order_no) AS label, status, work_order_no, created_at
         FROM txn.prod_ann_run
         WHERE tenant_id = $1 AND furnace_code = $2 AND COALESCE(updated_at, created_at) >= $3
         ORDER BY updated_at DESC NULLS LAST LIMIT 50`,
        [tenant, machine, since]
      );
    } else if (process === 'STP') {
      records = await safeQuery(
        `SELECT id, work_order_no AS label, status, work_order_no, created_at
         FROM txn.prod_stp_lot
         WHERE tenant_id = $1 AND machine_code = $2 AND COALESCE(updated_at, created_at) >= $3
         ORDER BY updated_at DESC NULLS LAST LIMIT 50`,
        [tenant, machine, since]
      );
    } else if (process === 'DRW') {
      records = await safeQuery(
        `SELECT id, COALESCE(lot_no, work_order_no) AS label, status, work_order_no, created_at
         FROM txn.prod_db_lot
         WHERE tenant_id = $1 AND bench_code = $2 AND created_at >= $3
         ORDER BY created_at DESC LIMIT 50`,
        [tenant, machine, since]
      );
    } else if (process === 'SWG') {
      records = await safeQuery(
        `SELECT id, work_order_no AS label, status, work_order_no, created_at
         FROM txn.prod_db_swage
         WHERE tenant_id = $1 AND swg_machine = $2 AND created_at >= $3
         ORDER BY created_at DESC LIMIT 50`,
        [tenant, machine, since]
      );
    }
    return {
      level: 'record',
      metric,
      process,
      machine,
      items: records.map((r) => ({
        id: String(r.id),
        label: r.label,
        status: r.status,
        workOrderNo: r.work_order_no,
        mt: r.mt != null ? Number(r.mt) : null,
        at: r.created_at,
      })),
    };
  }

  return { level: 'record', metric, process, machine, shift, items: [] };
}

export async function searchCoilTraceability(coilNo) {
  const q = String(coilNo || '').trim();
  if (!q) return { coilNo: q, lots: [], journey: [] };

  const tenant = TENANT();
  const pattern = `%${q}%`;

  const lots = await safeQuery(
    `SELECT id, lot_tag, coil_tag, work_order_no, status, current_process, origin_process, origin_record_id, size
     FROM txn.material_lot
     WHERE tenant_id = $1 AND (lot_tag ILIKE $2 OR coil_tag ILIKE $2 OR work_order_no ILIKE $2)
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 40`,
    [tenant, pattern]
  );

  const coils = await safeQuery(
    `SELECT c.coil_tag, c.run_id, r.run_no, r.mill_code, r.work_order_no, r.status
     FROM txn.prod_tm_coil_input c
     JOIN txn.prod_tm_run r ON r.id = c.run_id
     WHERE c.tenant_id = $1 AND c.coil_tag ILIKE $2
     LIMIT 40`,
    [tenant, pattern]
  );

  const handoffs = lots.length
    ? await safeQuery(
        `SELECT h.material_lot_id, h.from_process, h.to_process, h.handed_at, h.from_record_id, h.to_record_id
         FROM txn.process_handoff h
         WHERE h.tenant_id = $1 AND h.material_lot_id = ANY($2::uuid[])
         ORDER BY h.handed_at`,
        [tenant, lots.map((l) => l.id)]
      )
    : [];

  return {
    coilNo: q,
    lots: lots.map((l) => ({
      id: String(l.id),
      lotTag: l.lot_tag,
      coilTag: l.coil_tag,
      workOrderNo: l.work_order_no,
      status: l.status,
      currentProcess: l.current_process,
      originProcess: l.origin_process,
      originRecordId: l.origin_record_id,
      size: l.size,
    })),
    tmCoils: coils.map((c) => ({
      coilTag: c.coil_tag,
      runId: String(c.run_id),
      runNo: c.run_no,
      millCode: c.mill_code,
      workOrderNo: c.work_order_no,
      status: c.status,
    })),
    journey: handoffs.map((h) => ({
      materialLotId: String(h.material_lot_id),
      fromProcess: h.from_process,
      toProcess: h.to_process,
      handedAt: h.handed_at,
      fromRecordId: h.from_record_id,
      toRecordId: h.to_record_id,
    })),
  };
}

export async function suggestCoils(q) {
  const pattern = `%${String(q || '').trim()}%`;
  if (pattern.length < 3) return [];
  const rows = await safeQuery(
    `SELECT DISTINCT coil_tag AS tag FROM txn.prod_tm_coil_input
     WHERE tenant_id = $1 AND coil_tag ILIKE $2
     UNION
     SELECT DISTINCT lot_tag AS tag FROM txn.material_lot
     WHERE tenant_id = $1 AND (lot_tag ILIKE $2 OR coil_tag ILIKE $2)
     ORDER BY 1 LIMIT 20`,
    [TENANT(), pattern]
  );
  return rows.map((r) => r.tag).filter(Boolean);
}

export async function getMachineHandoverSummary(millCode = 'A-59') {
  try {
    const shifts = await listShifts(millCode);
    return { millCode, shifts: shifts ?? [] };
  } catch {
    return { millCode, shifts: [] };
  }
}

export async function getProductionIntelligence(windowDays = 7) {
  const dash = await getPlantHeadDashboard(windowDays);
  const daily = await getDailyReport(new Date().toISOString().slice(0, 10));
  return {
    windowDays: dash.windowDays,
    kpi: dash.kpi,
    byProcess: dash.byProcess,
    daily,
  };
}

export async function getDefectIntelligence(windowDays = 14) {
  const dash = await getPlantHeadDashboard(windowDays);
  return { windowDays: dash.windowDays, topDefects: dash.topDefects, scrapMt: dash.kpi.scrapMt };
}

export async function getDowntimeIntelligence(windowDays = 14) {
  const dash = await getPlantHeadDashboard(windowDays);
  return {
    windowDays: dash.windowDays,
    downtimeMin: dash.kpi.downtimeMin,
    openStoppages: dash.kpi.openStoppages,
    topStoppages: dash.topStoppages,
  };
}

export async function getOrderTracking() {
  const backlog = await getPlantHeadBacklog();
  return { totals: backlog.totals, orders: backlog.orders };
}
