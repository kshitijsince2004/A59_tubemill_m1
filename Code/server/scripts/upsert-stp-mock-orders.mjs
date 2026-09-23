import { pool } from '../dist/db/pool.js';
import { config } from '../dist/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tenantId = config.tenantId;
const orders = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../seeds/erp_orders.json'), 'utf8')
).filter((o) => o.processHint === 'STP' || String(o.workOrderNo) === '26081750');

const client = await pool.connect();
try {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
  for (const o of orders) {
    await client.query(
      `INSERT INTO erp.released_order (
         tenant_id, bc_id, work_order_no, status, mill_code, customer_code, grade_code,
         lot_no, size, qty_pieces, planned_qty, source, payload, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'SEED',$12, now())
       ON CONFLICT (tenant_id, work_order_no) DO UPDATE SET
         status = EXCLUDED.status, customer_code = EXCLUDED.customer_code,
         grade_code = EXCLUDED.grade_code, lot_no = EXCLUDED.lot_no, size = EXCLUDED.size,
         qty_pieces = EXCLUDED.qty_pieces, planned_qty = EXCLUDED.planned_qty,
         source = 'SEED', payload = EXCLUDED.payload, updated_at = now()`,
      [
        tenantId,
        o.bcId,
        o.workOrderNo,
        o.status,
        o.millCode,
        o.customerCode,
        o.gradeCode,
        o.lotNo,
        JSON.stringify(o.size),
        o.qtyPieces,
        o.plannedQty,
        JSON.stringify(o),
      ]
    );
    for (const line of o.lines || []) {
      await client.query(
        `INSERT INTO erp.released_order_line (
           tenant_id, work_order_no, line_no, customer_code, grade_code, lot_no, coil_no, tdc, pass_no,
           size, qty_pieces, planned_qty, final_size, tube_shape, next_process, remarks, payload
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (tenant_id, work_order_no, line_no) DO UPDATE SET
           lot_no = EXCLUDED.lot_no, coil_no = EXCLUDED.coil_no, size = EXCLUDED.size,
           qty_pieces = EXCLUDED.qty_pieces, planned_qty = EXCLUDED.planned_qty,
           final_size = EXCLUDED.final_size, next_process = EXCLUDED.next_process, updated_at = now()`,
        [
          tenantId,
          o.workOrderNo,
          line.lineNo,
          o.customerCode,
          o.gradeCode,
          line.lotNo,
          line.coilNo,
          line.tdc,
          line.passNo,
          JSON.stringify(line.size),
          line.qtyPieces,
          line.plannedQty,
          JSON.stringify(line.finalSize || {}),
          line.tubeShape,
          line.nextProcess,
          'STP mock',
          JSON.stringify(line),
        ]
      );
    }
    console.log('upserted', o.workOrderNo, 'lines', (o.lines || []).length);
  }
} finally {
  client.release();
  await pool.end();
}
