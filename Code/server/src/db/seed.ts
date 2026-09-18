import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { config } from '../config';

const tenantId = config.tenantId;

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
    await client.query(`DELETE FROM txn.tm_defect WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.tm_setup_override_log WHERE tenant_id = $1`, [tenantId]);
    await client.query(`UPDATE txn.prod_tm_coil_input SET arcweld_log_id = NULL, edgemill_id = NULL WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await client.query(`DELETE FROM txn.tm_arcweld_log WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_edgemill WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_bundle WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_coil_input WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.tm_setup WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.prod_tm_run WHERE tenant_id = $1`, [tenantId]);

    await client.query(`DELETE FROM txn.tm_shift_log WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM plc.collector_health`);
    await client.query(`DELETE FROM plc.tag WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM txn.idempotency_key`);

    await client.query(`DELETE FROM master.tm_param_chart WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.stoppage_code WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.defect_code WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.customer WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.grade WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.machine WHERE tenant_id = $1`, [tenantId]);
    await client.query(`DELETE FROM master.tm_consumable WHERE tenant_id = $1`, [tenantId]);

    await client.query(
      `INSERT INTO master.machine (machine_code, tenant_id, label, saw_type, cutter_dia_min, cutter_dia_max)
       VALUES ('A-59', $1, 'A-59 ERW Tube Mill', 'FLYING', 300, 450)`,
      [tenantId],
    );

    await client.query(
      `INSERT INTO master.grade (code, tenant_id, label, density_kg_m3) VALUES ('1010', $1, 'SAE 1010', 7850)`,
      [tenantId],
    );

    for (const c of ['TATA', 'JINDAL', 'AMNS']) {
      await client.query(
        `INSERT INTO master.customer (code, tenant_id, name) VALUES ($1, $2, $3)`,
        [c, tenantId, c],
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
    ];

    for (const s of stoppageCodes) {
      await client.query(
        `INSERT INTO master.stoppage_code (code, tenant_id, label, category, is_planned)
         VALUES ($1, $2, $3, $4, $5)`,
        [s.code, tenantId, s.label, s.category, s.isPlanned],
      );
    }

    const defectCodes = [
      { code: 'D-JOINT', label: 'Joint tube', category: 'PQ2' },
      { code: 'D-SEAM', label: 'Seam defect', category: 'CQ' },
      { code: 'D-DIM', label: 'Dimensional', category: 'OPEN' },
      { code: 'D-SCRAP', label: 'Scrap / reject', category: 'SCRAP' },
    ];
    for (const d of defectCodes) {
      await client.query(
        `INSERT INTO master.defect_code (code, tenant_id, label, category) VALUES ($1,$2,$3,$4)`,
        [d.code, tenantId, d.label, d.category],
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
          row.weldDiaMm,
        ],
      );
    }

    const consumables = [
      { code: '36', kind: 'WORK_COIL', thresholdMt: 50, thresholdUses: 200 },
      { code: '42', kind: 'WORK_COIL', thresholdMt: 40, thresholdUses: 180 },
      { code: 'CUT-A59-1', kind: 'CUTTER', thresholdMt: 100, thresholdUses: 500 },
      { code: 'IMP-16', kind: 'IMPEDER', thresholdMt: 80, thresholdUses: null },
      { code: 'FIN-01', kind: 'FIN_BLADE', thresholdMt: 30, thresholdUses: 100 },
    ];

    for (const c of consumables) {
      await client.query(
        `INSERT INTO master.tm_consumable (
          code, tenant_id, kind, replace_threshold_mt, replace_threshold_uses, status
        ) VALUES ($1,$2,$3,$4,$5,'ACTIVE')`,
        [c.code, tenantId, c.kind, c.thresholdMt, c.thresholdUses],
      );
    }

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
          card.qtyPieces,
        ],
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
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
