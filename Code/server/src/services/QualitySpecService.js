import { query, queryOne } from '../db/pool';
import { config } from '../config';

function mapSpec(row) {
  return {
    id: row.id,
    processCode: row.process_code,
    machineCode: row.machine_code,
    title: row.title,
    version: row.version,
    status: row.status,
    payload: row.payload ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export async function listQualitySpecs({ processCode } = {}) {
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  if (processCode) {
    clauses.push(`process_code = $2`);
    params.push(processCode);
  }
  const rows = await query(
    `SELECT * FROM master.process_quality_spec
     WHERE ${clauses.join(' AND ')}
     ORDER BY process_code, title, version DESC`,
    params
  );
  return rows.map(mapSpec);
}

export async function getQualitySpec(id) {
  const row = await queryOne(
    `SELECT * FROM master.process_quality_spec WHERE id = $1 AND tenant_id = $2`,
    [id, config.tenantId]
  );
  return row ? mapSpec(row) : null;
}

export async function createQualitySpec(input, createdBy) {
  const rows = await query(
    `INSERT INTO master.process_quality_spec (
       tenant_id, process_code, machine_code, title, version, status, payload, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [
      config.tenantId,
      String(input.processCode || 'TM'),
      input.machineCode || null,
      String(input.title || 'Untitled'),
      Number(input.version) || 1,
      String(input.status || 'DRAFT'),
      JSON.stringify(input.payload ?? {}),
      createdBy ?? null,
    ]
  );
  return mapSpec(rows[0]);
}

export async function updateQualitySpec(id, input) {
  const existing = await getQualitySpec(id);
  if (!existing) return null;
  const rows = await query(
    `UPDATE master.process_quality_spec SET
       process_code = COALESCE($3, process_code),
       machine_code = COALESCE($4, machine_code),
       title = COALESCE($5, title),
       version = COALESCE($6, version),
       status = COALESCE($7, status),
       payload = COALESCE($8::jsonb, payload),
       updated_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [
      id,
      config.tenantId,
      input.processCode ?? null,
      input.machineCode !== undefined ? input.machineCode || null : null,
      input.title ?? null,
      input.version != null ? Number(input.version) : null,
      input.status ?? null,
      input.payload != null ? JSON.stringify(input.payload) : null,
    ]
  );
  return rows[0] ? mapSpec(rows[0]) : null;
}

export async function seedDefaultQualitySpecs() {
  const stubs = [
    { processCode: 'TM', title: 'Tube Mill first-off & setup QSS', payload: { focus: 'first_off' } },
    { processCode: 'FUR', title: 'Furnace zone / soak QSS', payload: { focus: 'zones' } },
    { processCode: 'STP', title: 'STP bath analysis QSS', payload: { focus: 'bath' } },
    { processCode: 'DRW', title: 'Draw Bench inspection QSS', payload: { focus: 'inspection' } },
  ];
  for (const s of stubs) {
    const rows = await query(
      `SELECT id FROM master.process_quality_spec
       WHERE tenant_id = $1 AND process_code = $2 AND title = $3 LIMIT 1`,
      [config.tenantId, s.processCode, s.title]
    );
    if (!rows.length) {
      await createQualitySpec({ ...s, status: 'ACTIVE', version: 1 }, 'seed');
    }
  }
}
