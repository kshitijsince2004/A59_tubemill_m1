import { pool } from '../dist/db/pool.js';
import { config } from '../dist/config.js';

const tenantId = config.tenantId;
const client = await pool.connect();
try {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

  for (const [code, name] of [
    ['TATA', 'Tata Steel'],
    ['JINDAL', 'Jindal'],
    ['AMNS', 'AMNS'],
    ['MARMON', 'Marmon'],
  ]) {
    await client.query(
      `INSERT INTO master.customer (code, tenant_id, name) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [code, tenantId, name]
    );
  }

  for (const [code, label] of [
    ['1010', 'SAE 1010'],
    ['1020', 'SAE 1020'],
  ]) {
    await client.query(
      `INSERT INTO master.grade (code, tenant_id, label, density_kg_m3) VALUES ($1,$2,$3,7850)
       ON CONFLICT DO NOTHING`,
      [code, tenantId, label]
    );
  }

  await client.query(
    `INSERT INTO master.machine (machine_code, tenant_id, label, process_code)
     VALUES ('STP-01', $1, 'STP-01 Line', 'STP')
     ON CONFLICT DO NOTHING`,
    [tenantId]
  );
  await client.query(
    `INSERT INTO master.machine (machine_code, tenant_id, label, process_code)
     VALUES ('STP-LINE', $1, 'STP Line 105A', 'STP')
     ON CONFLICT DO NOTHING`,
    [tenantId]
  );

  const cust = await client.query(`SELECT code FROM master.customer WHERE tenant_id=$1 ORDER BY 1`, [tenantId]);
  const grade = await client.query(`SELECT code FROM master.grade WHERE tenant_id=$1 ORDER BY 1`, [tenantId]);
  const mach = await client.query(
    `SELECT machine_code FROM master.machine WHERE tenant_id=$1 AND process_code='STP'`,
    [tenantId]
  );
  console.log('customers', cust.rows.map((r) => r.code));
  console.log('grades', grade.rows.map((r) => r.code));
  console.log('stp machines', mach.rows.map((r) => r.machine_code));
} finally {
  client.release();
  await pool.end();
}
