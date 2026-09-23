import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { config } from '../config';
import { hashPin } from '../services/pinService';

const tenantId = config.tenantId;

async function wipeTenantTable(
client,
table)
{
  try {
    await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
    if (code === '42P01') return; // undefined_table — migrate first
    throw err;
  }
}

async function seed() {
  const seedsDir = path.resolve(__dirname, '../../seeds');
  const paramChart = JSON.parse(fs.readFileSync(path.join(seedsDir, 'tm_param_chart.json'), 'utf8'));
  const queue = JSON.parse(fs.readFileSync(path.join(seedsDir, 'queue_plan.json'), 'utf8'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

    // Break circular FK: prod_tm_run.setup_id → tm_setup.id (tm_setup.run_id → run)
    await client.query(`UPDATE txn.prod_tm_run SET setup_id = NULL WHERE tenant_id = $1`, [tenantId]);

    // Children / logs that reference runs (some without ON DELETE CASCADE)
    await client.query(`DELETE FROM ops.bc_writeback_log WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM ops.queue_card WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.tm_consumable_usage WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM plc.sample WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.tm_exception WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.stoppage_entry WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_param_snapshot WHERE tenant_id = $1`, [tenantId]);
    await wipeTenantTable(client, 'txn.tm_param_reading');
    await wipeTenantTable(client, 'txn.tm_mill_setup');
    await client.query(`DELETE FROM txn.tm_defect WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.tm_setup_override_log WHERE tenant_id = $1`, [tenantId]);
    await client.query(`UPDATE txn.prod_tm_coil_input SET arcweld_log_id = NULL, edgemill_id = NULL WHERE tenant_id = $1`, [
    tenantId]
    );
    await client.query(`DELETE FROM txn.tm_arcweld_log WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_edgemill WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_bundle WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_coil_input WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.tm_setup WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_run WHERE tenant_id = $1`, [tenantId]);

    // Phase-1 process tables (no-op if migrate 007 not applied yet)
    await wipeTenantTable(client, 'txn.ann_gas_log');
    await wipeTenantTable(client, 'txn.prod_ann_run');
    await wipeTenantTable(client, 'txn.stp_bath_analysis');
    await wipeTenantTable(client, 'txn.stp_coating');
    await wipeTenantTable(client, 'txn.stp_bath_history');
    await wipeTenantTable(client, 'txn.prod_stp_lot');
    await wipeTenantTable(client, 'txn.db_shift_check');
    await wipeTenantTable(client, 'txn.db_inspection');
    await wipeTenantTable(client, 'txn.db_tooling_issue');
    await wipeTenantTable(client, 'txn.db_tooling_usage');
    await wipeTenantTable(client, 'txn.prod_db_swage');
    await wipeTenantTable(client, 'txn.prod_db_lot');
    await wipeTenantTable(client, 'txn.tm_online_inspection');
    await wipeTenantTable(client, 'master.db_tooling');
    await wipeTenantTable(client, 'master.db_bench_capability');
    await wipeTenantTable(client, 'master.db_paint_colour');
    await wipeTenantTable(client, 'master.db_swage_end_spec');
    await wipeTenantTable(client, 'master.stp_bath_spec');
    await wipeTenantTable(client, 'master.shift_check_template');
    await wipeTenantTable(client, 'master.process');

    // ERP control tables (no-op if migrate 009 not applied)
    await wipeTenantTable(client, 'erp.writeback_job');
    await wipeTenantTable(client, 'erp.raw_landing');
    await wipeTenantTable(client, 'erp.code_map');
    await wipeTenantTable(client, 'erp.released_order_line');
    await wipeTenantTable(client, 'erp.released_order');
    await wipeTenantTable(client, 'erp.item_ledger');
    await wipeTenantTable(client, 'erp.capacity_ledger');
    await wipeTenantTable(client, 'erp.value_entry');
    await wipeTenantTable(client, 'erp.sync_watermark');

    await wipeTenantTable(client, 'txn.process_handoff');
    await wipeTenantTable(client, 'txn.material_lot');
    await wipeTenantTable(client, 'master.fur_zone_recipe');

    await client.query(`DELETE FROM txn.tm_shift_log WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM plc.collector_health`);
    await client.query(`DELETE FROM plc.tag WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.idempotency_key`);

    await client.query(`DELETE FROM master.tm_param_chart WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.stoppage_code WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.defect_code WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.customer WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.grade WHERE tenant_id = $1`, [tenantId]);

    await wipeTenantTable(client, 'security.machine_access');
    await wipeTenantTable(client, 'security.process_access');
    await wipeTenantTable(client, 'security.user_role');
    await wipeTenantTable(client, 'security.app_user');

    await client.query(`DELETE FROM master.machine WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.tm_consumable WHERE tenant_id = $1`, [tenantId]);

    const processes = [
    { code: 'TM', label: 'Tube Mill', sort: 1 },
    { code: 'FUR', label: 'Furnace', sort: 2 },
    { code: 'STP', label: 'STP', sort: 3 },
    { code: 'DRW', label: 'Draw Bench', sort: 4 },
    { code: 'SWG', label: 'Swaging', sort: 5 }];

    for (const p of processes) {
      await client.query(
        `INSERT INTO master.process (code, tenant_id, label, sort_order) VALUES ($1,$2,$3,$4)`,
        [p.code, tenantId, p.label, p.sort]
      );
    }

    await client.query(
      `INSERT INTO master.machine (machine_code, tenant_id, label, saw_type, cutter_dia_min, cutter_dia_max, process_code)
       VALUES ('A-59', $1, 'A-59 ERW Tube Mill', 'FLYING', 300, 450, 'TM')`,
      [tenantId]
    );

    for (const rhf of [
    { code: 'RHF-03', label: 'RHF-03 Annealing', gas: 'EXO', order: 1 },
    { code: 'RHF-04', label: 'RHF-04 Annealing', gas: 'N2-PSA', order: 2 },
    { code: 'RHF-05', label: 'RHF-05 Annealing', gas: 'N2-PSA', order: 3 }])
    {
      await client.query(
        `INSERT INTO master.machine (
           machine_code, tenant_id, label, process_code, furnace_type, gas_type, enabled, display_order
         ) VALUES ($1,$2,$3,'FUR','RHF',$4,true,$5)`,
        [rhf.code, tenantId, rhf.label, rhf.gas, rhf.order]
      );
    }

    await client.query(
      `INSERT INTO master.machine (machine_code, tenant_id, label, process_code) VALUES ('STP-LINE', $1, 'STP Line 105A', 'STP')`,
      [tenantId]
    );
    await client.query(
      `INSERT INTO master.machine (machine_code, tenant_id, label, process_code) VALUES ('STP-01', $1, 'STP-01', 'STP')
       ON CONFLICT DO NOTHING`,
      [tenantId]
    );

    const benches = [
    { code: 'DB-10T', t: 10, label: 'Draw Bench 10T' },
    { code: 'DB-20T', t: 20, label: 'Draw Bench 20T' },
    { code: 'DB-40T', t: 40, label: 'Draw Bench 40T' },
    { code: 'DB-45T', t: 45, label: 'Draw Bench 45T (3 tube)' },
    { code: 'DB-80T', t: 80, label: 'Draw Bench 80T' },
    { code: 'DB-120T', t: 120, label: 'Draw Bench 120T' },
    { code: 'DB-180T', t: 180, label: 'Draw Bench 180T (LDP)' },
    { code: 'DB-250T', t: 250, label: 'Draw Bench 250T (LDP)' },
    { code: 'SWG-01', t: 0, label: 'Swage Machine 01' }];

    // Table-C bands from Draw Bench mapping workbook
    const tableC = {
      'DB-10T': { mhOd: [11, 38.1], mhThk: [0.89, 2.5], finOd: [6.5, 25.4], finThk: [0.7, 2.0] },
      'DB-20T': { mhOd: [22.23, 44.45], mhThk: [1.4, 5.8], finOd: [12.7, 60.3], finThk: [0.8, 5.0] },
      'DB-40T': { mhOd: [28.58, 88.9], mhThk: [2.0, 6.4], finOd: [38.1, 76.2], finThk: [1.0, 6.4] },
      'DB-45T': { mhOd: [25.4, 50.8], mhThk: [2.0, 3.0], finOd: [null, null], finThk: [2.0, 3.6] },
      'DB-80T': { mhOd: [38.1, 127], mhThk: [2.0, 7.5], finOd: [50.8, 114.3], finThk: [null, null] },
      'DB-120T': { mhOd: [63.5, 114.3], mhThk: [7.5, 9.5], finOd: [null, null], finThk: [7.0, 9.0] },
      'DB-180T': { mhOd: [88.9, 168.3], mhThk: [4, 13], finOd: [63.5, 140], finThk: [3, 12.7] },
      'DB-250T': { mhOd: [88.9, 219.1], mhThk: [4, 15], finOd: [63.5, 212.0], finThk: [3, 14] }
    };

    for (const b of benches) {
      await client.query(
        `INSERT INTO master.machine (machine_code, tenant_id, label, process_code)
         VALUES ($1,$2,$3,$4)`,
        [b.code, tenantId, b.label, b.code.startsWith('SWG') ? 'SWG' : 'DRW']
      );
      if (!b.code.startsWith('SWG')) {
        const c = tableC[b.code] ?? { mhOd: [12, 120], mhThk: [null, null], finOd: [12, 120], finThk: [null, null] };
        await client.query(
          `INSERT INTO master.db_bench_capability (
             bench_code, tenant_id, tonnage_t, od_min_mm, od_max_mm, label,
             mh_od_min_mm, mh_od_max_mm, mh_thk_min_mm, mh_thk_max_mm,
             fin_od_min_mm, fin_od_max_mm, fin_thk_min_mm, fin_thk_max_mm
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            b.code,
            tenantId,
            b.t,
            c.mhOd[0],
            c.mhOd[1],
            b.label,
            c.mhOd[0],
            c.mhOd[1],
            c.mhThk[0],
            c.mhThk[1],
            c.finOd[0],
            c.finOd[1],
            c.finThk[0],
            c.finThk[1],
          ]
        );
      }
    }

    await wipeTenantTable(client, 'master.db_paint_colour');
    await wipeTenantTable(client, 'master.db_swage_end_spec');

    const paints = [
      ['1008', 'White'],
      ['1010', 'White'],
      ['1020', 'Yellow'],
      ['1026', 'Smoke grey'],
      ['ST52', 'Pink'],
      ['BSK46', 'Brown'],
      ['CORTON', 'Blue'],
      ['SAE-1541', 'Light blue + white'],
      ['SPL-K3', 'Orange'],
      ['GRADE-50', 'Light pink + white'],
    ];
    for (const [g, colour] of paints) {
      await client.query(
        `INSERT INTO master.db_paint_colour (grade_code, tenant_id, paint_colour) VALUES ($1,$2,$3)`,
        [g, tenantId, colour]
      );
    }

    const swageBands = [
      [10, 20, 80, 10, null, null, 'DB-10T & DB-20T'],
      [40, 80, 100, 10, null, null, 'DB-40T & DB-80T'],
      [120, 120, 120, 10, null, null, 'DB-120T'],
      [180, 250, null, null, 190, 225, 'DB-180T & DB-250T (LDP)'],
    ];
    for (const [tMin, tMax, nom, tol, lo, hi, label] of swageBands) {
      await client.query(
        `INSERT INTO master.db_swage_end_spec (
           tenant_id, tonnage_min, tonnage_max, length_nom_mm, length_tol_mm, length_min_mm, length_max_mm, label
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, tMin, tMax, nom, tol, lo, hi, label]
      );
    }

    await client.query(
      `INSERT INTO master.grade (code, tenant_id, label, density_kg_m3) VALUES ('1010', $1, 'SAE 1010', 7850)`,
      [tenantId]
    );
    await client.query(
      `INSERT INTO master.grade (code, tenant_id, label, density_kg_m3) VALUES ('1020', $1, 'SAE 1020', 7850)
       ON CONFLICT DO NOTHING`,
      [tenantId]
    );

    await client.query(
      `INSERT INTO master.fur_zone_recipe (tenant_id, grade_code, furnace_code, soaking_spec_c, speed_spec_m_hr, ht_type)
       VALUES
         ($1,'1010','RHF-03',900,22,'ANNEAL'),
         ($1,'1010','RHF-04',900,22,'ANNEAL'),
         ($1,'1010','RHF-05',905,20,'ANNEAL')`,
      [tenantId]
    );

    for (const c of ['TATA', 'JINDAL', 'AMNS', 'MARMON']) {
      await client.query(
        `INSERT INTO master.customer (code, tenant_id, name) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [c, tenantId, c]
      );
    }

    const stoppageCodes = [
    { code: 'TM-01', label: 'Roll change', category: 'PLANNED', isPlanned: true },
    { code: 'TM-02', label: 'Welder fault', category: 'ELECT', isPlanned: false },
    { code: 'TM-03', label: 'Mechanical breakdown', category: 'MECH', isPlanned: false },
    { code: 'TM-04', label: 'Power failure', category: 'POWER', isPlanned: false },
    { code: 'TM-05', label: 'Utility (water/air)', category: 'UTILITY', isPlanned: false },
    { code: 'TM-06', label: 'Operator stop', category: 'OPN', isPlanned: false },
    { code: 'TM-07', label: 'Material issue', category: 'OTHER', isPlanned: false },
    { code: 'TM-08', label: 'Planned maintenance', category: 'PLANNED', isPlanned: true },
    { code: 'FUR-01', label: 'Furnace burner fault (stub)', category: 'ELECT', isPlanned: false },
    { code: 'FUR-02', label: 'Atmosphere fault (stub)', category: 'OTHER', isPlanned: false },
    { code: 'STP-01', label: 'Crane stop (stub)', category: 'MECH', isPlanned: false },
    { code: 'STP-02', label: 'Bath chemistry hold (stub)', category: 'OTHER', isPlanned: false },
    { code: 'DRW-01', label: 'Die change (stub)', category: 'PLANNED', isPlanned: true },
    { code: 'DRW-02', label: 'Draw breakdown (stub)', category: 'MECH', isPlanned: false }];


    for (const s of stoppageCodes) {
      await client.query(
        `INSERT INTO master.stoppage_code (code, tenant_id, label, category, is_planned)
         VALUES ($1, $2, $3, $4, $5)`,
        [s.code, tenantId, s.label, s.category, s.isPlanned]
      );
    }

    const defectCodes = [
    { code: 'D-JOINT', label: 'Joint tube', category: 'PQ2' },
    { code: 'D-SEAM', label: 'Seam defect', category: 'CQ' },
    { code: 'D-DIM', label: 'Dimensional', category: 'OPEN' },
    { code: 'D-SCRAP', label: 'Scrap / reject', category: 'SCRAP' }];

    for (const d of defectCodes) {
      await client.query(
        `INSERT INTO master.defect_code (code, tenant_id, label, category) VALUES ($1,$2,$3,$4)`,
        [d.code, tenantId, d.label, d.category]
      );
    }

    for (const row of paramChart) {
      await client.query(
        `INSERT INTO master.tm_param_chart (
          tenant_id, size_key, thk_mm, grade_code,
          power_kw_min, power_kw_max, speed_min_mpm, speed_max_mpm,
          id_tool, od_tool, boggie, impeder, ferrite_rod, ss_rod, work_coil_id,
          seam_guide, weld_dia_mm, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true)`,
        [
        tenantId,
        row.sizeKey,
        row.thkMm,
        row.gradeCode,
        row.powerKwMin,
        row.powerKwMax,
        row.speedMinMpm,
        row.speedMaxMpm,
        row.idTool,
        row.odTool,
        row.boggie,
        row.impeder,
        row.ferriteRod,
        row.ssRod,
        row.workCoilId,
        row.seamGuide,
        row.weldDiaMm]

      );
    }

    const consumables = [
    { code: '36', kind: 'WORK_COIL', thresholdMt: 50, thresholdUses: 200 },
    { code: '42', kind: 'WORK_COIL', thresholdMt: 40, thresholdUses: 180 },
    { code: 'CUT-A59-1', kind: 'CUTTER', thresholdMt: 100, thresholdUses: 500 },
    { code: 'IMP-16', kind: 'IMPEDER', thresholdMt: 80, thresholdUses: null },
    { code: 'FIN-01', kind: 'FIN_BLADE', thresholdMt: 30, thresholdUses: 100 }];


    for (const c of consumables) {
      await client.query(
        `INSERT INTO master.tm_consumable (
          code, tenant_id, kind, replace_threshold_mt, replace_threshold_uses, status
        ) VALUES ($1,$2,$3,$4,$5,'ACTIVE')`,
        [c.code, tenantId, c.kind, c.thresholdMt, c.thresholdUses]
      );
    }

    await client.query(
      `INSERT INTO master.stp_bath_spec (tenant_id, bath_code, bath_label, param_key, min_val, max_val, unit)
       VALUES
         ($1,'DEGREASE','Degreasing','TA',78,90,'ml'),
         ($1,'PICKLE','HCl pickling','HCl',6,22,'%'),
         ($1,'PICKLE','HCl pickling','Fe',0,10,'%'),
         ($1,'ACT','Activation','pH',7,8,''),
         ($1,'PHOS','Phosphating','TA',32,38,'pts'),
         ($1,'PHOS','Phosphating','FA',4,6,'pts'),
         ($1,'PHOS','Phosphating','ACC',3,5,'pts'),
         ($1,'PHOS','Phosphating','OXTA',18,22,'pts'),
         ($1,'NEUT','Neutralizer','pH',8,10,''),
         ($1,'LUBE','Lube','CON',4,6,'%'),
         ($1,'LUBE','Lube','FA',0,1,'%'),
         ($1,'LUBE','Lube','pH',8,10,''),
         ($1,'RINSE','Water rinse','pH',2,10,''),
         ($1,'OIL','Oil bath','acid_no',100,200,''),
         ($1,'NEUT_FINAL','Neutralizer final','pH',6.5,7.5,'')`,
      [tenantId]
    );

    for (const die of [
    { code: 'DIE-38.1', od: 38.1 },
    { code: 'DIE-31.8', od: 31.8 },
    { code: 'DIE-25.4', od: 25.4 }])
    {
      await client.query(
        `INSERT INTO master.db_tooling (die_code, tenant_id, supplier, od_required_mm, received_at, status)
         VALUES ($1,$2,'GLI Tooling',$3,CURRENT_DATE,'ACTIVE')`,
        [die.code, tenantId, die.od]
      );
    }

    for (const chk of [
    { key: 'clean', label: 'Machine clean' },
    { key: 'die_plug', label: 'Die/plug OK' },
    { key: 'lube', label: 'Lube OK' },
    { key: 'pressure', label: 'Pressure OK' },
    { key: 'noise', label: 'Noise OK' }])
    {
      await client.query(
        `INSERT INTO master.shift_check_template (tenant_id, process_code, check_key, label, sort_order)
         VALUES ($1,'DRW',$2,$3,$4)`,
        [tenantId, chk.key, chk.label, 0]
      );
    }

    // Sample furnace / STP / draw lots for demo
    await client.query(
      `INSERT INTO txn.prod_ann_run (
         tenant_id, charge_no, furnace_code, customer_code, grade_code, work_order_no, size,
         tube_count, ht_type, zone1_min_c, zone1_max_c, zone2_min_c, zone2_max_c,
         zone3_min_c, zone3_max_c, zone4_min_c, zone4_max_c, zone5_min_c, zone5_max_c,
         zone6_min_c, zone6_max_c, line_speed_mhr, status, data_source, prod_date, shift_ref
       ) VALUES (
         $1,'FUR-DEMO-001','RHF-03','TATA','1010','WO-FUR-001','{"odMm":38.1,"thkMm":2.0}',
         120,'ANNEAL',880,900,900,920,920,940,940,960,960,980,980,1000,12.5,
         'DRAFT','MANUAL',CURRENT_DATE,'A'
       )`,
      [tenantId]
    );

    await client.query(
      `INSERT INTO txn.prod_stp_lot (
         tenant_id, lot_no, customer_code, grade_code, work_order_no, size, qty_no, qty_mt,
         machine_code, degrease_temp_c, phosphate_temp_c, status, data_source, prod_date, shift_ref
       ) VALUES (
         $1,'STP-DEMO-001','TATA','1010','WO-STP-001','{"odMm":38.1,"thkMm":2.0}',100,1.2,
         'STP-LINE',70,80,'DRAFT','MANUAL',CURRENT_DATE,'A'
       )`,
      [tenantId]
    );

    await client.query(
      `INSERT INTO txn.prod_db_lot (
         tenant_id, lot_no, work_order_no, customer_code, grade_code, size, bench_code, draw_pass,
         from_size, to_size, stage, accepted_pcs, rejected_pcs, status, data_source, prod_date, shift_ref
       ) VALUES (
         $1,'DB-DEMO-001','WO-DRW-001','TATA','1010','{"odMm":31.8,"thkMm":1.6}','DB-40T','1ST',
         '{"odMm":38.1,"thkMm":2.0}','{"odMm":31.8,"thkMm":1.6}','INTER',80,2,'DRAFT','MANUAL',CURRENT_DATE,'A'
       )`,
      [tenantId]
    );

    // Queue last so a failed earlier step never leaves an empty card list mid-wipe
    for (const card of queue) {
      await client.query(
        `INSERT INTO ops.queue_card (
          id, tenant_id, mill_code, status, work_order_no, bc_batch_number,
          customer_code, grade_code, size_key, size, qty_pieces
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
        card.id,
        tenantId,
        card.millCode,
        card.status,
        card.workOrderNo,
        card.bcBatchNumber,
        card.customerCode,
        card.gradeCode,
        card.sizeKey,
        JSON.stringify(card.size),
        card.qtyPieces]

      );
    }

    // RBAC demo users (PIN 1234 for all; staff also use email/password via SuperTokens on first login)
    const pinHash = await hashPin('1234');

    const machineRows = await client.query(
      `SELECT machine_code, process_code, label FROM master.machine WHERE tenant_id = $1 ORDER BY process_code, machine_code`,
      [tenantId]
    );
    const allMachines = machineRows.rows.map((r) => r.machine_code);
    const machinesByProcess = machineRows.rows.reduce((acc, row) => {
      const code = row.process_code || 'TM';
      if (!acc[code]) acc[code] = [];
      acc[code].push(row.machine_code);
      return acc;
    }, {});

    const processLabels = {
      TM: 'Tube Mill',
      FUR: 'Furnace',
      STP: 'STP',
      DRW: 'Draw Bench',
      SWG: 'Swage',
    };

    /** Badge-friendly code from machine_code (A-59 → A59, RHF-03 → RHF03). */
    function machineBadgeSlug(machineCode) {
      return String(machineCode).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }

    const processHeadDefs = [
      { process: 'TM', empCode: 'MH-TM', username: 'mh.tm', email: 'mh.tm@a59.local' },
      { process: 'FUR', empCode: 'MH-FUR', username: 'mh.fur', email: 'mh.fur@a59.local' },
      { process: 'STP', empCode: 'MH-STP', username: 'mh.stp', email: 'mh.stp@a59.local' },
      { process: 'DRW', empCode: 'MH-DRW', username: 'mh.drw', email: 'mh.drw@a59.local' },
      { process: 'SWG', empCode: 'MH-SWG', username: 'mh.swg', email: 'mh.swg@a59.local' },
    ];

    const processMachineHeads = processHeadDefs.map((h) => ({
      username: h.username,
      fullName: `${processLabels[h.process] ?? h.process} Machine Head`,
      empCode: h.empCode,
      email: h.email,
      roles: ['MACHINE_HEAD'],
      processes: [{ code: h.process, level: 'APPROVE' }],
      machines: machinesByProcess[h.process] ?? [],
    }));

    const perMachineOperators = machineRows.rows.map((m) => {
      const slug = machineBadgeSlug(m.machine_code);
      const process = m.process_code || 'TM';
      return {
        username: `op.${String(m.machine_code).toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
        fullName: `${m.label || m.machine_code} Operator`,
        empCode: `OP-${slug}`,
        email: `op.${slug.toLowerCase()}@a59.local`,
        roles: ['OPERATOR'],
        processes: [{ code: process, level: 'WRITE' }],
        machines: [m.machine_code],
      };
    });

    const demoUsers = [
      {
        username: 'admin',
        fullName: 'A-59 Admin',
        empCode: 'ADM-01',
        email: 'admin@a59.local',
        roles: ['ADMIN'],
        processes: [
          { code: 'TM', level: 'APPROVE' },
          { code: 'FUR', level: 'APPROVE' },
          { code: 'STP', level: 'APPROVE' },
          { code: 'DRW', level: 'APPROVE' },
          { code: 'SWG', level: 'APPROVE' },
        ],
        machines: 'ALL',
      },
      {
        username: 'machinehead',
        fullName: 'Plant Machine Head',
        empCode: 'MH-01',
        email: 'machinehead@a59.local',
        roles: ['MACHINE_HEAD'],
        processes: [
          { code: 'TM', level: 'APPROVE' },
          { code: 'FUR', level: 'APPROVE' },
          { code: 'STP', level: 'APPROVE' },
          { code: 'DRW', level: 'APPROVE' },
          { code: 'SWG', level: 'APPROVE' },
        ],
        machines: 'ALL',
      },
      ...processMachineHeads,
      {
        username: 'planthead',
        fullName: 'Plant Head',
        empCode: 'PH-01',
        email: 'planthead@a59.local',
        roles: ['PLANT_HEAD'],
        processes: [
          { code: 'TM', level: 'READ' },
          { code: 'FUR', level: 'READ' },
          { code: 'STP', level: 'READ' },
          { code: 'DRW', level: 'READ' },
          { code: 'SWG', level: 'READ' },
        ],
        machines: 'ALL',
      },
      ...perMachineOperators,
    ];

    for (const u of demoUsers) {
      const inserted = await client.query(
        `INSERT INTO security.app_user (
           tenant_id, username, full_name, emp_code, email, pin_hash, status
         ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE')
         RETURNING user_id`,
        [tenantId, u.username, u.fullName, u.empCode, u.email, pinHash]
      );
      const userId = inserted.rows[0].user_id;
      for (const role of u.roles) {
        await client.query(
          `INSERT INTO security.user_role (user_id, role_code, tenant_id) VALUES ($1,$2,$3)`,
          [userId, role, tenantId]
        );
      }
      for (const p of u.processes) {
        await client.query(
          `INSERT INTO security.process_access (user_id, process_code, access_level, tenant_id)
           VALUES ($1,$2,$3,$4)`,
          [userId, p.code, p.level, tenantId]
        );
      }
      const machines = u.machines === 'ALL' ? allMachines : u.machines;
      for (const code of machines) {
        await client.query(
          `INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
           VALUES ($1,$2,'WRITE',$3)
           ON CONFLICT DO NOTHING`,
          [userId, code, tenantId]
        );
      }
    }

    // All Released ERP WOs + lines (FUR/STP/DRW/TM dropdowns work without manual sync)
    const erpOrdersPath = path.join(seedsDir, 'erp_orders.json');
    const erpOrders = JSON.parse(fs.readFileSync(erpOrdersPath, 'utf8'));
    const releasedOrders = erpOrders.filter((o) => String(o.status ?? '') === 'Released');
    for (const o of releasedOrders) {
      await client.query(
        `INSERT INTO erp.released_order (
           tenant_id, bc_id, work_order_no, status, mill_code, customer_code, grade_code,
           lot_no, size, qty_pieces, planned_qty, source, payload, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SEED',$12, now())
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
           source = 'SEED',
           payload = EXCLUDED.payload,
           updated_at = now()`,
        [
          tenantId,
          o.bcId ?? o.workOrderNo,
          o.workOrderNo,
          o.status ?? 'Released',
          o.millCode ?? 'A-59',
          o.customerCode ?? null,
          o.gradeCode ?? null,
          o.lotNo ?? null,
          JSON.stringify(o.size ?? {}),
          o.qtyPieces ?? null,
          o.plannedQty ?? null,
          JSON.stringify(o),
        ]
      );
      const lines = Array.isArray(o.lines) && o.lines.length
        ? o.lines
        : [
            {
              lineNo: 1,
              lotNo: o.lotNo,
              coilNo: o.lotNo,
              size: o.size,
              qtyPieces: o.qtyPieces,
              plannedQty: o.plannedQty,
              tubeShape: o.size?.profile ?? 'ROUND',
            },
          ];
      for (const line of lines) {
        await client.query(
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
            tenantId,
            o.workOrderNo,
            line.lineNo ?? 1,
            o.customerCode ?? null,
            o.gradeCode ?? null,
            line.lotNo ?? o.lotNo ?? null,
            line.coilNo ?? line.lotNo ?? o.lotNo ?? null,
            line.tdc ?? null,
            line.passNo ?? null,
            JSON.stringify(line.size ?? o.size ?? {}),
            line.qtyPieces ?? o.qtyPieces ?? null,
            line.plannedQty ?? o.plannedQty ?? null,
            JSON.stringify(line.finalSize ?? {}),
            line.tubeShape ?? o.size?.profile ?? null,
            line.nextProcess ?? null,
            line.remarks ?? `STP mock line ${line.lineNo ?? 1}`,
            JSON.stringify(line),
          ]
        );
      }
    }
    console.log(`Seeded ${releasedOrders.length} Released work order(s) with lines`);

    try {
      const { seedDefaultQualitySpecs } = await import('../services/QualitySpecService.js');
      await seedDefaultQualitySpecs();
      console.log('Seeded default quality specs');
    } catch (e) {
      console.warn('Quality spec seed skipped:', e instanceof Error ? e.message : e);
    }

    await client.query('COMMIT');
    console.log('Seed complete. Badge + PIN for all users: PIN 1234');
    console.log(
      'Machine heads: MH-01, MH-TM, MH-FUR, MH-STP, MH-DRW, MH-SWG'
    );
    console.log(
      `Operators: ${perMachineOperators.map((u) => u.empCode).join(', ')}`
    );
    console.log('Also: ADM-01, PH-01 — same PIN 1234');

    // Warm ERP watermarks / code_map / masters while pool is still open
    try {
      const { syncEntities } = await import('../erp/ErpSyncService.js');
      const summary = await syncEntities();
      console.log('Post-seed ERP sync:', JSON.stringify(summary));
    } catch (e) {
      console.warn('Post-seed ERP sync skipped:', e instanceof Error ? e.message : e);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});