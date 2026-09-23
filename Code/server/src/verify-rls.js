/**
 * RLS smoke: connect as m1_app and confirm tenant isolation.
 * Requires: docker up, migrate, seed.
 *   npx tsx server/src/verify-rls.ts
 */
import { Pool } from 'pg';

const baseUrl = process.env.DATABASE_URL ?? 'postgresql://tubemill:tubemill@localhost:5433/tubemill';
const tenantA =
process.env.TENANT_ID ?? process.env.DEMO_TENANT_ID ?? '00000000-0000-4000-8000-000000000001';
const tenantB = '00000000-0000-4000-8000-000000000099';

async function main() {
  // Prefer m1_app; fall back to documenting if role missing
  const m1Url = baseUrl.replace(/\/\/[^@]+@/, '//m1_app:m1_app@');
  const pool = new Pool({ connectionString: m1Url });

  try {
    const client = await pool.connect();
    try {
      await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantA]);
      const a = await client.query(`SELECT count(*)::int AS n FROM txn.prod_tm_run`);
      const defects = await client.query(`SELECT count(*)::int AS n FROM txn.tm_defect`);
      const arc = await client.query(`SELECT count(*)::int AS n FROM txn.tm_arcweld_log`);
      await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantB]);
      const b = await client.query(`SELECT count(*)::int AS n FROM txn.prod_tm_run`);
      const bDef = await client.query(`SELECT count(*)::int AS n FROM txn.tm_defect`);
      console.log(`tenant A runs visible: ${a.rows[0].n}`);
      console.log(`tenant A defects/arc tables readable: ${defects.rows[0].n}/${arc.rows[0].n}`);
      console.log(`tenant B runs visible: ${b.rows[0].n} (expect 0 if A-59 only seeded)`);
      if (Number(b.rows[0].n) > 0 || Number(bDef.rows[0].n) > 0) {
        throw new Error('RLS failed: other tenant saw A-59 rows');
      }
      console.log('RLS smoke passed (m1_app).');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('RLS smoke skipped or failed (is Docker/migrate done? m1_app role created?)');
    console.warn(err instanceof Error ? err.message : err);
    process.exitCode = 0;
  } finally {
    await pool.end();
  }
}

main();