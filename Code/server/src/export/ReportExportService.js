import fs from 'fs';
import path from 'path';

import { injectReport, buildBlankTemplate } from './render/TemplateInjector';
import { query } from '../db/pool';
import { config } from '../config';
import layoutDb from './layouts/DB-FT-01.v1.json';
import layoutDb03 from './layouts/DB-FT-03.v1.json';
import layoutDb08 from './layouts/DB-FT-08.v1.json';
import layoutAnn from './layouts/ANN-FT-01.v1.json';
import layoutN2Gas from './layouts/N2-GAS-FT-01.v1.json';
import layoutExoGas from './layouts/EXO-GAS-FT-02.v1.json';
import layoutStp from './layouts/STP-FT-01A.v1.json';
import layoutStp04 from './layouts/STP-FT-04.v1.json';
import layoutStp06 from './layouts/STP-06.v1.json';
import layoutTm from './layouts/TM-FT-02.v1.json';

const REPORTS = [
{
  code: 'DB-FT-01',
  processId: 'DRW',
  templateFile: 'DB-FT-01.xlsx',
  layoutFile: 'DB-FT-01.v1.json',
  filenamePattern: 'A59_DB-FT-01_{date}.xlsx'
},
{
  code: 'DB-FT-03',
  processId: 'DRW',
  templateFile: 'DB-FT-03.xlsx',
  layoutFile: 'DB-FT-03.v1.json',
  filenamePattern: 'A59_DB-FT-03_{date}.xlsx'
},
{
  code: 'DB-FT-08',
  processId: 'DRW',
  templateFile: 'DB-FT-08.xlsx',
  layoutFile: 'DB-FT-08.v1.json',
  filenamePattern: 'A59_DB-FT-08_{date}.xlsx'
},
{
  code: 'ANN-FT-01',
  processId: 'FUR',
  templateFile: 'ANN-FT-01.xlsx',
  layoutFile: 'ANN-FT-01.v1.json',
  filenamePattern: 'A59_ANN-FT-01_{date}.xlsx'
},
{
  code: 'N2-GAS-FT-01',
  processId: 'FUR',
  templateFile: 'N2-GAS-FT-01.xlsx',
  layoutFile: 'N2-GAS-FT-01.v1.json',
  filenamePattern: 'A59_N2-GAS-FT-01_{date}.xlsx'
},
{
  code: 'EXO-GAS-FT-02',
  processId: 'FUR',
  templateFile: 'EXO-GAS-FT-02.xlsx',
  layoutFile: 'EXO-GAS-FT-02.v1.json',
  filenamePattern: 'A59_EXO-GAS-FT-02_{date}.xlsx'
},
{
  code: 'STP-FT-01A',
  processId: 'STP',
  templateFile: 'STP-FT-01A.xlsx',
  layoutFile: 'STP-FT-01A.v1.json',
  filenamePattern: 'A59_STP-FT-01A_{date}.xlsx'
},
{
  code: 'STP-FT-04',
  processId: 'STP',
  templateFile: 'STP-FT-04.xlsx',
  layoutFile: 'STP-FT-04.v1.json',
  filenamePattern: 'A59_STP-FT-04_{date}.xlsx'
},
{
  code: 'STP-06',
  processId: 'STP',
  templateFile: 'STP-06.xlsx',
  layoutFile: 'STP-06.v1.json',
  filenamePattern: 'A59_STP-06_{date}.xlsx'
},
{
  code: 'TM-FT-02',
  processId: 'TM',
  templateFile: 'TM-FT-02.xlsx',
  layoutFile: 'TM-FT-02.v1.json',
  filenamePattern: 'A59_TM-FT-02_{date}.xlsx'
}];


const LAYOUTS = {
  'DB-FT-01': layoutDb,
  'DB-FT-03': layoutDb03,
  'DB-FT-08': layoutDb08,
  'ANN-FT-01': layoutAnn,
  'N2-GAS-FT-01': layoutN2Gas,
  'EXO-GAS-FT-02': layoutExoGas,
  'STP-FT-01A': layoutStp,
  'STP-FT-04': layoutStp04,
  'STP-06': layoutStp06,
  'TM-FT-02': layoutTm
};

function formatAnnSize(size) {
  if (!size) return '';
  const s = typeof size === 'string' ? (() => { try { return JSON.parse(size); } catch { return {}; } })() : size;
  const od = s.odMm ?? s.od ?? '';
  const thk = s.thkMm ?? s.thk ?? '';
  const len = s.lengthMm ?? s.len ?? '';
  if (od === '' && thk === '' && len === '') return '';
  return `${od} × ${thk} × ${len}`;
}

/** STP-FT-01A right-table titration columns → paper labels. */
const STP_ANALYSIS_COLS = [
  { col: 'degrease_ta', bath: 'Degreasing', param: 'TA', spec: '78–90 ml', chem: 'G-390' },
  { col: 'hcl_pct', bath: 'HCl pickling', param: 'HCl%', spec: '6–22 %', chem: 'HCl-30% min' },
  { col: 'fe_pct', bath: 'HCl pickling', param: 'Fe%', spec: '10 % max', chem: 'HCl-30% min' },
  { col: 'activation_ph', bath: 'Activation', param: 'pH', spec: '7–8', chem: 'GV-6521' },
  { col: 'phos_ta', bath: 'Phosphating', param: 'TA', spec: '32–38', chem: '3510E' },
  { col: 'phos_fa', bath: 'Phosphating', param: 'FA', spec: '4–6', chem: '3510A' },
  { col: 'phos_acc', bath: 'Phosphating', param: 'ACC', spec: '3–5', chem: 'GB-14' },
  { col: 'phos_oxta', bath: 'Phosphating', param: 'OXTA', spec: '18–22', chem: '3510E' },
  { col: 'neut_ph', bath: 'Neutralizer', param: 'pH', spec: '8–10', chem: 'G-21' },
  { col: 'lube_con', bath: 'Lube', param: 'CON', spec: '4–6 %', chem: 'G-3005' },
  { col: 'lube_fa', bath: 'Lube', param: 'FA', spec: '0–1 %', chem: 'G-3005' },
  { col: 'lube_ph', bath: 'Lube', param: 'pH', spec: '8–10', chem: 'G-3005' },
  { col: 'rinse_ph', bath: 'Water rinse', param: 'pH', spec: '2–10', chem: '' },
  { col: 'oil_water_acid_no', bath: 'Oil bath', param: 'acid-no', spec: '100–200', chem: 'Bondrite LR 06021' },
];

function expandStpAnalysisRows(analysisRecords) {
  const out = [];
  const latest = analysisRecords[analysisRecords.length - 1];
  if (!latest) {
    return STP_ANALYSIS_COLS.map((d) => ({
      bath_name: d.bath,
      parameter: d.param,
      spec_value: d.spec,
      obz_value: '',
      chem_name: d.chem,
    }));
  }
  for (const d of STP_ANALYSIS_COLS) {
    out.push({
      bath_name: d.bath,
      parameter: d.param,
      spec_value: d.spec,
      obz_value: latest[d.col] ?? '',
      chem_name: d.chem,
    });
  }
  return out;
}

function templatesDir() {
  const candidates = [
  path.resolve(__dirname, 'templates'),
  path.resolve(process.cwd(), 'src/export/templates'),
  path.resolve(process.cwd(), 'server/src/export/templates')];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const fallback = path.resolve(__dirname, 'templates');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

async function ensureTemplate(def, layout) {
  const dir = templatesDir();
  const file = path.join(dir, def.templateFile);
  if (!fs.existsSync(file)) {
    const buf = await buildBlankTemplate(layout);
    fs.writeFileSync(file, buf);
  }
  return file;
}

async function mapDbFt01(filters) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filters.id) {
    clauses.push(`id = $${i++}`);
    params.push(filters.id);
  }
  if (filters.dateFrom) {
    clauses.push(`prod_date >= $${i++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push(`prod_date <= $${i++}`);
    params.push(filters.dateTo);
  }
  const rows = await query(
    `SELECT * FROM txn.prod_db_lot WHERE ${clauses.join(' AND ')} ORDER BY bench_code, created_at LIMIT 500`,
    params
  );
  const first = rows[0];
  const headerDate = first?.prod_date
    ? String(first.prod_date).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const headerShift = filters.shift ?? first?.shift_ref ?? '';
  return {
    header: {
      date: headerDate,
      shift: headerShift,
      supervisor: filters.supervisor ?? first?.supervisor_ref ?? '',
      incharge: filters.incharge ?? first?.shift_incharge_ref ?? '',
    },
    rows: rows.map((r) => ({
      bench_code: r.bench_code,
      operator_ref: r.operator_ref,
      work_order_no: r.work_order_no,
      grade_code: r.grade_code,
      customer_name: r.customer_name ?? r.customer_code,
      final_od_mm: r.final_od_mm,
      final_id_mm: r.final_id_mm,
      final_th_mm: r.final_th_mm,
      final_len_mm: r.final_len_mm,
      from_od_mm: r.from_od_mm,
      from_th_mm: r.from_th_mm,
      from_len_mm: r.from_len_mm,
      to_od_mm: r.to_od_mm,
      to_id_mm: r.to_id_mm,
      to_th_mm: r.to_th_mm,
      to_len_mm: r.to_len_mm,
      draw_plan_len_mm: r.draw_plan_len_mm,
      pass_type: r.pass_type ?? r.stage,
      accepted_nos: r.accepted_pcs,
      accepted_mt: r.accepted_mt,
      rejected_nos: r.rejected_pcs,
      drawn_meter: r.drawn_metre,
      remarks: r.remarks ?? '',
      breakdown_remark: r.breakdown_remark ?? '',
    })),
  };
}

async function mapDbFt03(filters) {
  const dieCode = filters.dieCode ?? null;
  let tooling = null;
  if (dieCode) {
    tooling = await query(
      `SELECT * FROM master.db_tooling WHERE tenant_id = $1 AND die_code = $2 LIMIT 1`,
      [config.tenantId, dieCode]
    ).then((r) => r[0] ?? null);
  } else if (filters.id) {
    const issue = await query(
      `SELECT die_code FROM txn.db_tooling_issue WHERE lot_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [filters.id, config.tenantId]
    ).then((r) => r[0] ?? null);
    if (issue?.die_code) {
      tooling = await query(
        `SELECT * FROM master.db_tooling WHERE tenant_id = $1 AND die_code = $2 LIMIT 1`,
        [config.tenantId, issue.die_code]
      ).then((r) => r[0] ?? null);
    }
  }
  const code = tooling?.die_code ?? dieCode ?? '';
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  if (code) {
    clauses.push(`die_code = $2`);
    params.push(code);
  }
  if (filters.id && !code) {
    clauses.push(`lot_id = $${params.length + 1}`);
    params.push(filters.id);
  }
  const hist = await query(
    `SELECT * FROM txn.db_tooling_usage WHERE ${clauses.join(' AND ')} ORDER BY use_date, created_at LIMIT 200`,
    params
  );
  return {
    header: {
      die_code: tooling?.die_code ?? code,
      supplier: tooling?.supplier ?? '',
      od_required: tooling?.od_required_mm ?? '',
      history_card_no: tooling?.die_code ?? code,
      status: tooling?.status ?? '',
      sign: '',
    },
    rows: hist.map((h) => ({
      use_date: h.use_date,
      od_at_prev_drawn: h.prev_draw_od_mm,
      tubes_produced: h.tubes_produced,
      input_tube_size: typeof h.input_size === 'object' ? JSON.stringify(h.input_size) : h.input_size,
      die_polishing: h.die_polish === true ? 'Y' : h.die_polish === false ? 'N' : '',
      die_oversized: h.oversized === true ? 'Y' : h.oversized === false ? 'N' : '',
      disposition: h.disposition,
      remarks: h.remarks,
    })),
  };
}

async function mapDbFt08(filters) {
  const params = [config.tenantId];
  let sql = `SELECT i.*, l.bench_code AS lot_bench, l.shift_ref
     FROM txn.db_tooling_issue i
     LEFT JOIN txn.prod_db_lot l ON l.id = i.lot_id
     WHERE i.tenant_id = $1`;
  if (filters.id) {
    params.push(filters.id);
    sql += ` AND i.lot_id = $${params.length}`;
  }
  if (filters.dieCode) {
    params.push(filters.dieCode);
    sql += ` AND i.die_code = $${params.length}`;
  }
  sql += ` ORDER BY i.created_at DESC LIMIT 200`;
  const rows = await query(sql, params);
  return {
    header: {
      date: new Date().toISOString().slice(0, 10),
      shift: filters.shift ?? rows[0]?.shift_ref ?? '',
      sign: '',
    },
    rows: rows.map((r) => {
      let tubeOd = null;
      let tubeId = null;
      let tubeThk = null;
      try {
        const sz = typeof r.issue_size === 'string' ? JSON.parse(r.issue_size) : r.issue_size;
        if (sz && typeof sz === 'object') {
          tubeOd = sz.odMm ?? sz.od;
          tubeId = sz.idMm ?? sz.id;
          tubeThk = sz.thkMm ?? sz.thk;
        }
      } catch {
        /* ignore */
      }
      return {
        bench_code: r.lot_bench ?? '',
        tube_od: tubeOd,
        tube_id: tubeId,
        tube_thk: tubeThk,
        die_code: r.die_code,
        die_stage: r.stage,
        die_size_mm: r.die_size_mm,
        tube_od_first_off: r.actual_od_1stoff_mm,
        die_condition: r.die_condition,
        plug_stage: r.plug_stage,
        plug_size_mm: r.plug_size_mm,
        plug_condition: r.plug_condition,
      };
    }),
  };
}

async function mapAnnFt01(filters) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filters.id) {
    clauses.push(`id = $${i++}`);
    params.push(filters.id);
  }
  const rows = await query(
    `SELECT * FROM txn.prod_ann_run WHERE ${clauses.join(' AND ')} ORDER BY created_at LIMIT 500`,
    params
  );
  const operatorName =
    filters.incharge ?? filters.supervisor ?? rows[0]?.created_by ?? '';
  return {
    header: {
      date: rows[0]?.prod_date
        ? String(rows[0].prod_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      shift: filters.shift ?? rows[0]?.shift_ref ?? '',
      supervisor: filters.supervisor ?? rows[0]?.created_by ?? operatorName,
      incharge: operatorName,
      png_a: rows[0]?.png_a ?? rows[0]?.png_consumption ?? '',
      png_b: rows[0]?.png_b ?? '',
      png_c: rows[0]?.png_c ?? '',
      nh3_a: rows[0]?.nh3_a ?? rows[0]?.nh3_consumption ?? '',
      nh3_b: rows[0]?.nh3_b ?? '',
      nh3_c: rows[0]?.nh3_c ?? '',
    },
    rows: rows.map((r, idx) => ({
      sl_no: idx + 1,
      customer_name: r.customer_code,
      size: formatAnnSize(r.size),
      work_order_no: r.work_order_no,
      grade_code: r.grade_code,
      qty_nos: r.qty_nos ?? r.tube_count ?? r.total_nos,
      qty_mt: r.qty_mt ?? r.total_mt,
      heat_treatment: r.ht_type,
      zone1_min: r.zone1_min_c,
      zone1_max: r.zone1_max_c,
      zone2_min: r.zone2_min_c,
      zone2_max: r.zone2_max_c,
      zone3_min: r.zone3_min_c,
      zone3_max: r.zone3_max_c,
      zone4_min: r.zone4_min_c,
      zone4_max: r.zone4_max_c,
      zone5_min: r.zone5_min_c,
      zone5_max: r.zone5_max_c,
      zone6_min: r.zone6_min_c,
      zone6_max: r.zone6_max_c,
      line_speed_m_hr: r.line_speed_mhr,
      total_mt: r.total_mt ?? r.qty_mt,
      remarks: r.remarks,
    })),
  };
}

async function mapFurGas(filters, gasType) {
  const params = [config.tenantId, gasType];
  let sql = `
    SELECT g.*, r.charge_no, r.furnace_code, r.png_consumption, r.nh3_consumption, r.shift_ref, r.created_by
    FROM txn.ann_gas_log g
    LEFT JOIN txn.prod_ann_run r ON r.id = g.run_id
    WHERE g.tenant_id = $1 AND g.gas_type = $2`;
  if (filters.id) {
    params.push(filters.id);
    sql += ` AND g.run_id = $3`;
  }
  sql += ` ORDER BY g.logged_at DESC NULLS LAST LIMIT 500`;
  const rows = await query(sql, params);
  return {
    header: {
      date: new Date().toISOString().slice(0, 10),
      shift: filters.shift ?? rows[0]?.shift_ref ?? '',
      supervisor: rows[0]?.created_by ?? '',
    },
    rows: rows.map((r, idx) => {
      const gp = r.gas_params && typeof r.gas_params === 'object' ? r.gas_params : {};
      return {
        sl_no: idx + 1,
        charge_no: r.charge_no ?? '',
        furnace_code: r.furnace_code ?? '',
        logged_at: r.logged_at ? new Date(r.logged_at).toISOString() : '',
        dew_point_c: r.dew_point_c,
        h2_pct: r.h2_pct,
        o2_ppm: r.o2_ppm,
        flow: gp.flow ?? '',
        pressure: gp.pressure ?? '',
        png_consumption: r.png_consumption,
        nh3_consumption: r.nh3_consumption,
        remarks: r.remarks ?? '',
      };
    }),
  };
}

async function mapN2GasFt01(filters) {
  return mapFurGas(filters, 'N2-PSA');
}

async function mapExoGasFt02(filters) {
  return mapFurGas(filters, 'EXO');
}

async function mapStpFt01a(filters) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filters.id) {
    clauses.push(`id = $${i++}`);
    params.push(filters.id);
  }
  const rows = await query(
    `SELECT * FROM txn.prod_stp_lot WHERE ${clauses.join(' AND ')} ORDER BY created_at LIMIT 500`,
    params
  );
  const analysis =
    filters.id != null
      ? await query(
          `SELECT * FROM txn.stp_bath_analysis WHERE lot_id = $1 AND tenant_id = $2 ORDER BY sampled_at`,
          [filters.id, config.tenantId]
        )
      : rows[0]
        ? await query(
            `SELECT * FROM txn.stp_bath_analysis WHERE lot_id = $1 AND tenant_id = $2 ORDER BY sampled_at`,
            [rows[0].id, config.tenantId]
          )
        : [];
  return {
    header: {
      date: new Date().toISOString().slice(0, 10),
      shift: filters.shift ?? rows[0]?.shift_ref ?? '',
      supervisor: rows[0]?.created_by ?? '',
      incharge: '',
    },
    rows: rows.map((r, idx) => ({
      sl_no: idx + 1,
      customer_name: r.customer_code,
      grade_code: r.grade_code,
      size: JSON.stringify(r.size ?? {}),
      work_order_no: r.work_order_no,
      qty_no: r.qty_no,
      qty_mt: r.qty_mt,
      degrease_temp_c: r.degrease_temp_c,
      degrease_time_min: r.degrease_time_min,
      descale_time_min: r.descale_time_min ?? r.pickle_time_min,
      phos_temp_c: r.phosphate_temp_c,
      phos_time_min: r.phosphate_time_min,
      neut_temp_c: r.neut_temp_c,
      neut_dip: r.neutralizer_time_min,
      lube_temp_c: r.lube_temp_c,
      lube_time_min: r.lube_time_min,
      dryer_temp_c: r.dryer_temp_c,
      dryer_time_min: r.dryer_time_min,
      sf_neut_temp_c: r.sf_neut_temp_c,
      roil_time_min: r.reactive_oil_time_min,
    })),
    analysisRows: expandStpAnalysisRows(analysis),
  };
}

async function mapStpFt04(filters) {
  const rows = await query(
    `SELECT * FROM txn.stp_bath_history WHERE tenant_id = $1 ORDER BY planned_change_date DESC NULLS LAST LIMIT 200`,
    [config.tenantId]
  );
  return {
    header: {
      date: new Date().toISOString().slice(0, 10),
      shift: filters.shift ?? '',
      supervisor: '',
    },
    rows: rows.map((r, idx) => {
      const planned = r.planned_change_date ? String(r.planned_change_date).slice(0, 10) : '';
      const executed = r.executed_change_date ? String(r.executed_change_date).slice(0, 10) : '';
      let nextDue = '';
      if (executed && r.planned_freq_days) {
        const d = new Date(executed);
        d.setDate(d.getDate() + Number(r.planned_freq_days));
        nextDue = d.toISOString().slice(0, 10);
      }
      return {
        sl_no: idx + 1,
        bath_name: r.bath_code,
        change_freq: r.planned_freq_days != null ? `${r.planned_freq_days} days` : '',
        last_change: executed || planned,
        next_due: nextDue,
        remarks: r.remarks ?? '',
      };
    }),
  };
}

async function mapStp06(filters) {
  const params = [config.tenantId];
  let sql = `
    SELECT c.*, l.lot_no, l.work_order_no
    FROM txn.stp_coating c
    LEFT JOIN txn.prod_stp_lot l ON l.id = c.lot_id
    WHERE c.tenant_id = $1`;
  if (filters.id) {
    params.push(filters.id);
    sql += ` AND c.lot_id = $2`;
  }
  sql += ` ORDER BY c.sample_date DESC NULLS LAST LIMIT 500`;
  const rows = await query(sql, params);
  return {
    header: {
      date: new Date().toISOString().slice(0, 10),
      shift: filters.shift ?? '',
      supervisor: '',
    },
    rows: rows.map((r, idx) => ({
      sl_no: idx + 1,
      lot_no: r.lot_no ?? '',
      work_order_no: r.work_order_no ?? '',
      sample_date: r.sample_date ? String(r.sample_date).slice(0, 10) : '',
      coating_gsm: r.coating_gm2,
      sample_no: r.sample_no,
      remarks: r.remarks ?? '',
    })),
  };
}

async function mapTmFt02(filters) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (filters.id) {
    clauses.push(`id = $${i++}`);
    params.push(filters.id);
  }
  const rows = await query(
    `SELECT * FROM txn.prod_tm_run WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,
    params
  );
  return {
    header: {
      date: new Date().toISOString().slice(0, 10),
      shift: filters.shift ?? '',
      mill: 'A-59',
      supervisor: '',
    },
    rows: rows.map((r) => ({
      work_order_no: r.work_order_no,
      grade_code: r.grade_code,
      size_key: r.size_key,
      prime_nos: '',
      prime_mt: r.total_prime_mt,
      pq2_mt: r.total_pq2_mt,
      cq_mt: r.total_cq_mt,
      open_mt: r.total_open_mt,
      scrap_mt: r.total_scrap_mt,
      raw_material_mt: r.raw_material_mt,
      yield_pct: r.yield_pct,
    })),
  };
}

const MAPPERS = {
  'DB-FT-01': mapDbFt01,
  'DB-FT-03': mapDbFt03,
  'DB-FT-08': mapDbFt08,
  'ANN-FT-01': mapAnnFt01,
  'N2-GAS-FT-01': mapN2GasFt01,
  'EXO-GAS-FT-02': mapExoGasFt02,
  'STP-FT-01A': mapStpFt01a,
  'STP-FT-04': mapStpFt04,
  'STP-06': mapStp06,
  'TM-FT-02': mapTmFt02,
};

export function listReports(processId) {
  return REPORTS.filter((r) => !processId || r.processId === processId);
}

export async function renderReport(
reportCode,
filters = {})
{
  const def = REPORTS.find((r) => r.code === reportCode);
  if (!def) throw new Error(`Unknown report ${reportCode}`);
  const layout = LAYOUTS[reportCode];
  if (!layout) throw new Error(`Missing layout for ${reportCode}`);
  const mapper = MAPPERS[reportCode];
  if (!mapper) throw new Error(`Missing mapper for ${reportCode}`);

  const templatePath = await ensureTemplate(def, layout);
  const mapped = await mapper(filters);
  const buffer = await injectReport(
    templatePath,
    layout,
    mapped.header,
    mapped.rows,
    mapped.analysisRows
  );
  const filename = def.filenamePattern.replace('{date}', new Date().toISOString().slice(0, 10));
  return { buffer, filename };
}