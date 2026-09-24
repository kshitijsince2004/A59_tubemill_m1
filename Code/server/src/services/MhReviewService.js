import { query } from '../db/pool';
import { config } from '../config';
import { accessibleMachineCodes, assertMachineApproval } from '../auth/machineAccessPolicy';
import { approveRun, getRun, holdRun } from './RunService';
import { getAnnRun, setAnnStatus, assertFurnaceApprovable, getFurnaceRecipe } from './FurnaceService';
import { getStpLot, setStpStatus, holdStpLot, assertStpBathSigned } from './StpService';
import { getDrwLot, setDrwStatus, assertDrwInspectionsDispositioned } from './DrawBenchService';
import { getSwageLot, setSwageStatus } from './SwageService';
import { recordAuditEvent } from './AuditTrailService';
import { resolveCrewForMachineShift } from './crewExportHelper';

function scopeParams(codes) {
  const tenant = config.tenantId;
  if (codes == null) return { millCol: (col) => 'TRUE', params: [tenant], tIdx: 1 };
  return {
    millCol: (col) => `${col} = ANY($1::text[])`,
    params: [codes, tenant],
    tIdx: 2,
  };
}

async function count(sql, params) {
  const rows = await query(sql, params);
  return Number(rows[0]?.n ?? 0);
}

function windowDaysAndSince(windowDays = 7) {
  const days = Math.min(90, Math.max(1, Number(windowDays) || 7));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);
  return { days, since };
}

function fillDaySeries(days, since, byDay) {
  const series = [];
  const start = new Date(since);
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key) ?? { mt: 0, yieldPct: 0, runs: 0 };
    series.push({ date: key, mt: row.mt, yieldPct: row.yieldPct, runs: row.runs });
  }
  return series;
}

function ageBucket(submittedAt) {
  const t = submittedAt ? new Date(submittedAt).getTime() : NaN;
  if (!Number.isFinite(t)) return 'unknown';
  const ageH = (Date.now() - t) / 3600000;
  if (ageH < 1) return 'under1h';
  if (ageH < 4) return '1to4h';
  return 'over4h';
}

/**
 * Narrow accessible codes to an optional machine filter (403 if out of scope).
 */
function resolveMachineScope(user, machine) {
  const codes = accessibleMachineCodes(user);
  if (!machine) return codes;
  const m = String(machine).trim();
  if (!m) return codes;
  if (codes != null) {
    const ok = codes.some((c) => String(c).toUpperCase() === m.toUpperCase());
    if (!ok) {
      const err = new Error('Machine out of scope');
      err.status = 403;
      throw err;
    }
  }
  return [m];
}

/**
 * Dashboard counts scoped to machineAccess (null codes = all for ADMIN/PH).
 */
export async function getMachineHeadDashboard(user) {
  const codes = accessibleMachineCodes(user);
  const byProcess = {};
  const { millCol, params, tIdx } = scopeParams(codes);

  byProcess.TM = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND status IN ('DRAFT','OPEN','SETUP')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND run_state = 'RUNNING'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_tm_run WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND hold_status = 'HELD'`,
      params
    ),
  };

  byProcess.FUR = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'IN_PROGRESS'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_ann_run WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'HOLD'`,
      params
    ),
  };

  byProcess.STP = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'IN_PROGRESS'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_stp_lot WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'HOLD'`,
      params
    ),
  };

  byProcess.DRW = {
    open: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
      params
    ),
    running: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'IN_PROGRESS'`,
      params
    ),
    submitted: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'SUBMITTED'`,
      params
    ),
    hold: await count(
      `SELECT COUNT(*)::int AS n FROM txn.prod_db_lot WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'HOLD'`,
      params
    ),
  };

  try {
    byProcess.SWG = {
      open: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status IN ('DRAFT','OPEN','IN_PROGRESS')`,
        params
      ),
      running: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'IN_PROGRESS'`,
        params
      ),
      submitted: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'SUBMITTED'`,
        params
      ),
      hold: await count(
        `SELECT COUNT(*)::int AS n FROM txn.prod_db_swage WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'HOLD'`,
        params
      ),
    };
  } catch {
    byProcess.SWG = { open: 0, running: 0, submitted: 0, hold: 0 };
  }

  return { byProcess, machineScope: codes };
}

export async function listPendingReview(user) {
  const codes = accessibleMachineCodes(user);
  const { millCol, params, tIdx } = scopeParams(codes);
  const items = [];

  {
    const rows = await query(
      `SELECT id, mill_code AS machine_code, status, work_order_no, created_at
       FROM txn.prod_tm_run
       WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')} AND status = 'SUBMITTED'
       ORDER BY created_at DESC LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'TM',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.created_at,
      });
    }
  }

  {
    const rows = await query(
      `SELECT id, furnace_code AS machine_code, status, work_order_no, charge_no, updated_at
       FROM txn.prod_ann_run
       WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')} AND status = 'SUBMITTED'
       ORDER BY updated_at DESC NULLS LAST LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'FUR',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.charge_no || r.work_order_no,
        submittedAt: r.updated_at,
      });
    }
  }

  {
    const rows = await query(
      `SELECT id, machine_code, status, work_order_no, updated_at
       FROM txn.prod_stp_lot
       WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')} AND status = 'SUBMITTED'
       ORDER BY updated_at DESC NULLS LAST LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'STP',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.updated_at,
      });
    }
  }

  {
    const rows = await query(
      `SELECT id, bench_code AS machine_code, status, work_order_no, created_at
       FROM txn.prod_db_lot
       WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')} AND status = 'SUBMITTED'
       ORDER BY created_at DESC LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'DRW',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.created_at,
      });
    }
  }

  try {
    const rows = await query(
      `SELECT id, swg_machine AS machine_code, status, work_order_no, created_at
       FROM txn.prod_db_swage
       WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')} AND status = 'SUBMITTED'
       ORDER BY created_at DESC LIMIT 100`,
      params
    );
    for (const r of rows) {
      items.push({
        process: 'SWG',
        id: r.id,
        machineCode: r.machine_code,
        status: r.status,
        workOrderNo: r.work_order_no,
        label: r.work_order_no,
        submittedAt: r.created_at,
      });
    }
  } catch {
    /* optional */
  }

  items.sort((a, b) => String(b.submittedAt ?? '').localeCompare(String(a.submittedAt ?? '')));

  const aging = { under1h: 0, '1to4h': 0, over4h: 0, unknown: 0 };
  for (const it of items) {
    const bucket = ageBucket(it.submittedAt);
    it.ageBucket = bucket;
    aging[bucket] = (aging[bucket] ?? 0) + 1;
  }

  return {
    items,
    aging: {
      under1h: aging.under1h,
      '1to4h': aging['1to4h'],
      over4h: aging.over4h,
      unknown: aging.unknown,
    },
  };
}

/**
 * Day-by-day MT / yield / runs for a process, machine-scoped.
 * @returns {{ process, windowDays, machineScope, series: Array<{ date, mt, yieldPct, runs }> }}
 */
export async function getMachineHeadTrend(user, { process, machine, windowDays = 7 } = {}) {
  const codes = resolveMachineScope(user, machine);
  const { millCol, params, tIdx } = scopeParams(codes);
  const { days, since } = windowDaysAndSince(windowDays);
  const p = String(process || 'TM').toUpperCase();
  const sinceIdx = params.length + 1;
  const qParams = [...params, since];

  let rows = [];
  if (p === 'TM') {
    rows = await query(
      `SELECT (COALESCE(created_at, time_from)::date) AS d,
              COALESCE(SUM(total_prime_mt),0)::float AS mt,
              COALESCE(SUM(raw_material_mt),0)::float AS raw_mt,
              COUNT(*)::int AS runs
       FROM txn.prod_tm_run
       WHERE tenant_id = $${tIdx} AND ${millCol('mill_code')}
         AND COALESCE(created_at, time_from) >= $${sinceIdx}
       GROUP BY 1 ORDER BY 1`,
      qParams
    );
  } else if (p === 'FUR') {
    rows = await query(
      `SELECT (COALESCE(updated_at, created_at)::date) AS d,
              COALESCE(SUM(COALESCE(total_mt,0)),0)::float AS mt,
              COUNT(*)::int AS runs
       FROM txn.prod_ann_run
       WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')}
         AND COALESCE(updated_at, created_at) >= $${sinceIdx}
       GROUP BY 1 ORDER BY 1`,
      qParams
    );
  } else if (p === 'STP') {
    rows = await query(
      `SELECT (COALESCE(updated_at, created_at)::date) AS d,
              COALESCE(SUM(COALESCE(qty_mt,0)),0)::float AS mt,
              COUNT(*)::int AS runs
       FROM txn.prod_stp_lot
       WHERE tenant_id = $${tIdx} AND ${millCol('machine_code')}
         AND COALESCE(updated_at, created_at) >= $${sinceIdx}
       GROUP BY 1 ORDER BY 1`,
      qParams
    );
  } else if (p === 'DRW') {
    rows = await query(
      `SELECT (COALESCE(created_at, now())::date) AS d,
              COALESCE(SUM(COALESCE(accepted_mt, 0)),0)::float AS mt,
              COUNT(*)::int AS runs
       FROM txn.prod_db_lot
       WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')}
         AND COALESCE(created_at, now()) >= $${sinceIdx}
       GROUP BY 1 ORDER BY 1`,
      qParams
    );
  } else if (p === 'SWG') {
    try {
      rows = await query(
        `SELECT (COALESCE(created_at, now())::date) AS d,
                0::float AS mt,
                COUNT(*)::int AS runs
         FROM txn.prod_db_swage
         WHERE tenant_id = $${tIdx} AND ${millCol('swg_machine')}
           AND COALESCE(created_at, now()) >= $${sinceIdx}
         GROUP BY 1 ORDER BY 1`,
        qParams
      );
    } catch {
      rows = [];
    }
  }

  const byDay = new Map();
  for (const r of rows) {
    const key = String(r.d).slice(0, 10);
    const mt = Number(r.mt ?? 0);
    const raw = Number(r.raw_mt ?? 0);
    const yieldPct = p === 'TM' && raw > 0 ? Math.round((mt / raw) * 1000) / 10 : 0;
    byDay.set(key, { mt, yieldPct, runs: Number(r.runs ?? 0) });
  }

  return {
    process: p,
    windowDays: days,
    machineScope: codes,
    series: fillDaySeries(days, since, byDay),
  };
}

/**
 * Process quality / control-chart series (FUR first; TM/STP/DRW supported).
 */
export async function getProcessQualitySeries(user, { process, machine, windowDays = 14 } = {}) {
  const codes = resolveMachineScope(user, machine);
  const { millCol, params, tIdx } = scopeParams(codes);
  const { days, since } = windowDaysAndSince(windowDays);
  const p = String(process || 'FUR').toUpperCase();
  const sinceIdx = params.length + 1;
  const qParams = [...params, since];

  if (p === 'FUR') {
    const rows = await query(
      `SELECT id, furnace_code, charge_no,
              COALESCE(production_ended_at, updated_at, created_at) AS at,
              zone1_min_c, zone1_max_c, zone2_min_c, zone2_max_c,
              zone3_min_c, zone3_max_c, zone4_min_c, zone4_max_c,
              zone5_min_c, zone5_max_c, zone6_min_c, zone6_max_c,
              line_speed_mhr, grade_code
       FROM txn.prod_ann_run
       WHERE tenant_id = $${tIdx} AND ${millCol('furnace_code')}
         AND COALESCE(production_ended_at, updated_at, created_at) >= $${sinceIdx}
       ORDER BY at ASC
       LIMIT 200`,
      qParams
    );

    const zoneMid = (min, max) => {
      const a = min != null ? Number(min) : null;
      const b = max != null ? Number(max) : null;
      if (a != null && b != null) return Math.round(((a + b) / 2) * 10) / 10;
      return a ?? b;
    };

    const series = [];
    const zones = [];
    const recipeCache = new Map();
    for (const r of rows) {
      const at = r.at ? new Date(r.at).toISOString() : null;
      let speedSpec = null;
      if (r.grade_code || r.furnace_code) {
        const cacheKey = `${r.grade_code || ''}|${r.furnace_code || ''}`;
        if (!recipeCache.has(cacheKey)) {
          try {
            recipeCache.set(
              cacheKey,
              await getFurnaceRecipe({ gradeCode: r.grade_code, furnaceCode: r.furnace_code })
            );
          } catch {
            recipeCache.set(cacheKey, null);
          }
        }
        speedSpec = recipeCache.get(cacheKey)?.speedSpecMhr ?? null;
      }
      const value = r.line_speed_mhr != null ? Number(r.line_speed_mhr) : null;
      const tol = speedSpec != null ? Math.max(5, speedSpec * 0.05) : null;
      const bandMin = speedSpec != null && tol != null ? speedSpec - tol : null;
      const bandMax = speedSpec != null && tol != null ? speedSpec + tol : null;
      const outOfBand =
        value != null && bandMin != null && bandMax != null && (value < bandMin || value > bandMax);

      series.push({
        at,
        value,
        bandMin,
        bandMax,
        target: speedSpec,
        outOfBand,
        machineCode: r.furnace_code,
        id: r.id,
        label: r.charge_no,
      });

      const z = {
        at,
        machineCode: r.furnace_code,
        id: r.id,
        zone1: zoneMid(r.zone1_min_c, r.zone1_max_c),
        zone2: zoneMid(r.zone2_min_c, r.zone2_max_c),
        zone3: zoneMid(r.zone3_min_c, r.zone3_max_c),
        zone4: zoneMid(r.zone4_min_c, r.zone4_max_c),
        zone5: zoneMid(r.zone5_min_c, r.zone5_max_c),
        zone6: zoneMid(r.zone6_min_c, r.zone6_max_c),
        bands: {
          zone1: { min: r.zone1_min_c != null ? Number(r.zone1_min_c) : null, max: r.zone1_max_c != null ? Number(r.zone1_max_c) : null },
          zone2: { min: r.zone2_min_c != null ? Number(r.zone2_min_c) : null, max: r.zone2_max_c != null ? Number(r.zone2_max_c) : null },
          zone3: { min: r.zone3_min_c != null ? Number(r.zone3_min_c) : null, max: r.zone3_max_c != null ? Number(r.zone3_max_c) : null },
          zone4: { min: r.zone4_min_c != null ? Number(r.zone4_min_c) : null, max: r.zone4_max_c != null ? Number(r.zone4_max_c) : null },
          zone5: { min: r.zone5_min_c != null ? Number(r.zone5_min_c) : null, max: r.zone5_max_c != null ? Number(r.zone5_max_c) : null },
          zone6: { min: r.zone6_min_c != null ? Number(r.zone6_min_c) : null, max: r.zone6_max_c != null ? Number(r.zone6_max_c) : null },
        },
      };
      const outKeys = [];
      for (let i = 1; i <= 6; i++) {
        const key = `zone${i}`;
        const v = z[key];
        const b = z.bands[key];
        if (v != null && b?.min != null && b?.max != null && (v < b.min || v > b.max)) {
          outKeys.push(key);
        }
      }
      z.outKeys = outKeys;
      z.outOfBand = outKeys.length > 0;
      zones.push(z);
    }

    return {
      process: 'FUR',
      metric: 'lineSpeedMhr',
      unit: 'm/hr',
      windowDays: days,
      machineScope: codes,
      series,
      zones,
    };
  }

  if (p === 'TM') {
    const rows = await query(
      `SELECT r.ts_hour AS at, r.mill_code, r.line_speed_mpm, r.in_band,
              c.speed_min_mpm, c.speed_max_mpm
       FROM txn.tm_param_reading r
       LEFT JOIN LATERAL (
         SELECT speed_min_mpm, speed_max_mpm
         FROM master.tm_param_chart pc
         WHERE pc.tenant_id = r.tenant_id AND pc.is_active = true
         ORDER BY pc.version DESC NULLS LAST
         LIMIT 1
       ) c ON TRUE
       WHERE r.tenant_id = $${tIdx} AND ${millCol('r.mill_code')}
         AND r.ts_hour >= $${sinceIdx}
       ORDER BY r.ts_hour ASC
       LIMIT 300`,
      qParams
    );
    const series = rows.map((r) => {
      const value = r.line_speed_mpm != null ? Number(r.line_speed_mpm) : null;
      const bandMin = r.speed_min_mpm != null ? Number(r.speed_min_mpm) : null;
      const bandMax = r.speed_max_mpm != null ? Number(r.speed_max_mpm) : null;
      const outOfBand =
        r.in_band === false ||
        (value != null && bandMin != null && bandMax != null && (value < bandMin || value > bandMax));
      return {
        at: r.at ? new Date(r.at).toISOString() : null,
        value,
        bandMin,
        bandMax,
        outOfBand,
        machineCode: r.mill_code,
      };
    });
    return {
      process: 'TM',
      metric: 'lineSpeedMpm',
      unit: 'm/min',
      windowDays: days,
      machineScope: codes,
      series,
    };
  }

  if (p === 'STP') {
    const rows = await query(
      `SELECT b.sampled_at AS at, b.hcl_pct, b.degrease_ta, b.fe_pct, b.phos_ta,
              l.machine_code, b.id
       FROM txn.stp_bath_analysis b
       JOIN txn.prod_stp_lot l ON l.id = b.lot_id
       WHERE b.tenant_id = $${tIdx} AND ${millCol('l.machine_code')}
         AND b.sampled_at >= $${sinceIdx}
       ORDER BY b.sampled_at ASC
       LIMIT 200`,
      qParams
    );
    let bandMin = null;
    let bandMax = null;
    try {
      const specs = await query(
        `SELECT min_val, max_val FROM master.stp_bath_spec
         WHERE tenant_id = $1 AND param_key IN ('hcl_pct','hcl')
         ORDER BY bath_code LIMIT 1`,
        [config.tenantId]
      );
      if (specs[0]) {
        bandMin = specs[0].min_val != null ? Number(specs[0].min_val) : null;
        bandMax = specs[0].max_val != null ? Number(specs[0].max_val) : null;
      }
    } catch {
      /* optional */
    }
    const series = rows.map((r) => {
      const value = r.hcl_pct != null ? Number(r.hcl_pct) : null;
      const outOfBand =
        value != null && bandMin != null && bandMax != null && (value < bandMin || value > bandMax);
      return {
        at: r.at ? new Date(r.at).toISOString() : null,
        value,
        bandMin,
        bandMax,
        outOfBand,
        machineCode: r.machine_code,
        id: r.id,
      };
    });
    return {
      process: 'STP',
      metric: 'hclPct',
      unit: '%',
      windowDays: days,
      machineScope: codes,
      series,
    };
  }

  if (p === 'DRW') {
    const rows = await query(
      `SELECT id, bench_code, COALESCE(updated_at, created_at) AS at,
              from_od_mm, to_od_mm, final_od_mm
       FROM txn.prod_db_lot
       WHERE tenant_id = $${tIdx} AND ${millCol('bench_code')}
         AND COALESCE(updated_at, created_at) >= $${sinceIdx}
       ORDER BY at ASC
       LIMIT 200`,
      qParams
    );
    const series = rows.map((r) => {
      const value =
        r.final_od_mm != null
          ? Number(r.final_od_mm)
          : r.to_od_mm != null
            ? Number(r.to_od_mm)
            : null;
      const from = r.from_od_mm != null ? Number(r.from_od_mm) : null;
      const to = r.to_od_mm != null ? Number(r.to_od_mm) : null;
      const bandMin = to != null && from != null ? Math.min(from, to) : null;
      const bandMax = to != null && from != null ? Math.max(from, to) : null;
      const outOfBand =
        value != null && bandMin != null && bandMax != null && (value < bandMin || value > bandMax);
      return {
        at: r.at ? new Date(r.at).toISOString() : null,
        value,
        bandMin,
        bandMax,
        outOfBand,
        machineCode: r.bench_code,
        id: r.id,
        fromOd: from,
        toOd: to,
      };
    });
    return {
      process: 'DRW',
      metric: 'odMm',
      unit: 'mm',
      windowDays: days,
      machineScope: codes,
      series,
    };
  }

  return {
    process: p,
    metric: null,
    unit: null,
    windowDays: days,
    machineScope: codes,
    series: [],
  };
}

async function resolveItem(process, id) {
  const p = String(process).toUpperCase();
  if (p === 'TM') {
    const run = await getRun(id);
    if (!run) return null;
    return { process: 'TM', id: run.id, machineCode: run.millCode, status: run.status, entity: run };
  }
  if (p === 'FUR') {
    const lot = await getAnnRun(id);
    if (!lot) return null;
    return { process: 'FUR', id: lot.id, machineCode: lot.furnaceCode, status: lot.status, entity: lot };
  }
  if (p === 'STP') {
    const lot = await getStpLot(id);
    if (!lot) return null;
    return { process: 'STP', id: lot.id, machineCode: lot.machineCode, status: lot.status, entity: lot };
  }
  if (p === 'DRW') {
    const lot = await getDrwLot(id);
    if (!lot) return null;
    return { process: 'DRW', id: lot.id, machineCode: lot.benchCode, status: lot.status, entity: lot };
  }
  if (p === 'SWG') {
    const lot = await getSwageLot(id);
    if (!lot) return null;
    return { process: 'SWG', id: lot.id, machineCode: lot.swgMachine, status: lot.status, entity: lot };
  }
  return null;
}

export async function reviewAction(user, process, id, action, remark) {
  const item = await resolveItem(process, id);
  if (!item) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  assertMachineApproval(user, item.machineCode);

  let result;
  if (action === 'approve') {
    if (item.process === 'TM') result = await approveRun(id);
    else if (item.process === 'FUR') {
      await assertFurnaceApprovable(item.entity);
      result = await setAnnStatus(id, 'APPROVED');
    } else if (item.process === 'STP') {
      await assertStpBathSigned(id, item.entity);
      result = await setStpStatus(id, 'APPROVED');
    } else if (item.process === 'DRW') {
      await assertDrwInspectionsDispositioned(id);
      result = await setDrwStatus(id, 'APPROVED');
    } else if (item.process === 'SWG') result = await setSwageStatus(id, 'APPROVED');
  } else if (action === 'hold') {
    if (item.process === 'TM') result = await holdRun(id, remark || 'Held by Machine Head');
    else if (item.process === 'FUR') result = await setAnnStatus(id, 'HOLD');
    else if (item.process === 'STP') result = await holdStpLot(id);
    else if (item.process === 'DRW') result = await setDrwStatus(id, 'HOLD');
    else if (item.process === 'SWG') result = await setSwageStatus(id, 'HOLD');
  } else if (action === 'reopen') {
    if (item.process === 'TM') {
      await query(`UPDATE txn.prod_tm_run SET status = 'DRAFT', hold_status = 'NONE' WHERE id = $1`, [id]);
      result = await getRun(id);
    } else if (item.process === 'FUR') result = await setAnnStatus(id, 'DRAFT');
    else if (item.process === 'STP') result = await setStpStatus(id, 'DRAFT');
    else if (item.process === 'DRW') result = await setDrwStatus(id, 'DRAFT');
    else if (item.process === 'SWG') result = await setSwageStatus(id, 'DRAFT');
  }

  if (result !== undefined) {
    await recordAuditEvent({
      actorUserId: user?.userId ?? null,
      actorUsername: user?.username ?? null,
      action: `REVIEW_${String(action).toUpperCase()}`,
      entityType: item.process,
      entityId: String(id),
      detail: { machineCode: item.machineCode, remark: remark ?? null },
    });
    return result;
  }

  const err = new Error(`Unknown action ${action}`);
  err.status = 400;
  throw err;
}

export async function getReviewItem(user, process, id) {
  const item = await resolveItem(process, id);
  if (!item) return null;
  assertMachineApproval(user, item.machineCode);
  const entity = item.entity ?? {};
  const prodDate = entity.prodDate ?? entity.prod_date ?? null;
  const shiftCode = entity.shiftRef ?? entity.shift_ref ?? entity.shiftCode ?? null;
  const crewFooter = await resolveCrewForMachineShift(item.machineCode, prodDate, shiftCode);
  return {
    process: item.process,
    id: item.id,
    machineCode: item.machineCode,
    status: item.status,
    entity: item.entity,
    crew: crewFooter.crew,
    crewNames: crewFooter.crewNames,
    shiftLogId: crewFooter.shiftLogId ?? null,
  };
}
