import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { accessibleMachineCodes, assertMachineApproval } from '../auth/machineAccessPolicy';

function mapRow(row) {
  return {
    id: row.id,
    machineCode: row.machine_code,
    roleLabel: row.role_label,
    personName: row.person_name,
    shiftCode: row.shift_code,
    createdAt: row.created_at,
  };
}

export async function listCrew(user, machineCode) {
  const codes = accessibleMachineCodes(user);
  const clauses = ['tenant_id = $1'];
  const params = [config.tenantId];
  let i = 2;
  if (machineCode) {
    clauses.push(`machine_code = $${i++}`);
    params.push(machineCode);
  } else if (codes != null) {
    if (!codes.length) return [];
    clauses.push(`machine_code = ANY($${i++}::text[])`);
    params.push(codes);
  }
  const rows = await query(
    `SELECT * FROM master.machine_crew_roster
     WHERE ${clauses.join(' AND ')}
     ORDER BY machine_code, role_label, person_name`,
    params
  );
  return rows.map(mapRow);
}

export async function addCrew(input) {
  if (!input.personName?.trim()) throw new Error('personName required');
  const rows = await query(
    `INSERT INTO master.machine_crew_roster (
       tenant_id, machine_code, role_label, person_name, shift_code
     ) VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      config.tenantId,
      input.machineCode,
      input.roleLabel || 'Operator',
      input.personName.trim(),
      input.shiftCode || 'A',
    ]
  );
  return mapRow(rows[0]);
}

export async function removeCrew(user, id) {
  const row = await queryOne(
    `SELECT * FROM master.machine_crew_roster WHERE id = $1 AND tenant_id = $2`,
    [id, config.tenantId]
  );
  if (!row) return null;
  assertMachineApproval(user, row.machine_code);
  await query(`DELETE FROM master.machine_crew_roster WHERE id = $1`, [id]);
  return mapRow(row);
}
