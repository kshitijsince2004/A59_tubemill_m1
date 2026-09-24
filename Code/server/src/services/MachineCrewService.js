import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { accessibleMachineCodes } from '../auth/machineAccessPolicy';
import { assertHandoverMachineAccess } from '../auth/handoverAccessPolicy';

const OPERATOR_NAME_CACHE_TTL_MS = 60_000;
/** @type {Map<string, { name: string|null, at: number }>} */
const operatorNameCache = new Map();

export class RosterTableMissingError extends Error {
  constructor() {
    super('Crew roster table missing — run migrations (032_crew_session_engine)');
    this.name = 'RosterTableMissingError';
    this.status = 503;
  }
}

function isMissingRelation(err) {
  return err?.code === '42P01' || /relation .* does not exist/i.test(String(err?.message ?? ''));
}

function mapRow(row) {
  return {
    id: row.id,
    crewId: row.id,
    machineCode: row.machine_code,
    roleLabel: row.role_label,
    personName: row.person_name,
    memberName: row.person_name,
    shiftCode: row.shift_code,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertCanReadMachine(user, machineCode) {
  if (!user) {
    const err = new Error('Unauthenticated');
    err.status = 401;
    throw err;
  }
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PLANT_HEAD')) return;
  const codes = accessibleMachineCodes(user);
  // MACHINE_HEAD / OPERATOR with grants: must be in scope when machine specified
  if (codes != null && machineCode) {
    // Empty grants: allow read of an explicitly requested machine for MH desk
    // only when they have no ACL rows yet is unusual; deny operators always.
    if (codes.length && !codes.includes(machineCode)) {
      const err = new Error(`No access to machine ${machineCode}`);
      err.status = 403;
      throw err;
    }
    if (
      !codes.length &&
      user.roles?.includes('OPERATOR') &&
      !user.roles?.includes('MACHINE_HEAD')
    ) {
      const err = new Error(`No access to machine ${machineCode}`);
      err.status = 403;
      throw err;
    }
  }
  if (
    user.roles?.includes('OPERATOR') &&
    !user.roles?.includes('MACHINE_HEAD') &&
    !machineCode
  ) {
    const err = new Error('machineCode required');
    err.status = 400;
    throw err;
  }
}

export async function listCrew(user, machineCode) {
  try {
    if (machineCode) {
      assertCanReadMachine(user, machineCode);
    } else if (user?.roles?.includes('OPERATOR') && !user.roles?.includes('MACHINE_HEAD')
      && !user.roles?.includes('PLANT_HEAD') && !user.roles?.includes('ADMIN')) {
      const err = new Error('machineCode required');
      err.status = 400;
      throw err;
    }

    const codes = accessibleMachineCodes(user);
    const clauses = ['tenant_id = $1', 'is_active = true'];
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
  } catch (e) {
    if (isMissingRelation(e)) throw new RosterTableMissingError();
    throw e;
  }
}

export async function addCrew(input) {
  try {
    const personName = String(input.personName ?? input.memberName ?? '').trim();
    if (!personName) throw Object.assign(new Error('personName required'), { status: 400 });
    const machineCode = String(input.machineCode ?? '');
    if (!machineCode) throw Object.assign(new Error('machineCode required'), { status: 400 });

    const rows = await query(
      `INSERT INTO master.machine_crew_roster (
         tenant_id, machine_code, role_label, person_name, shift_code, is_active
       ) VALUES ($1,$2,$3,$4,$5,true)
       RETURNING *`,
      [
        config.tenantId,
        machineCode,
        String(input.roleLabel || 'Operator').trim() || 'Operator',
        personName,
        String(input.shiftCode || 'A'),
      ]
    );
    operatorNameCache.delete(machineCode);
    return mapRow(rows[0]);
  } catch (e) {
    if (isMissingRelation(e)) throw new RosterTableMissingError();
    throw e;
  }
}

export async function updateCrew(user, crewId, patch) {
  try {
    const row = await queryOne(
      `SELECT * FROM master.machine_crew_roster
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [crewId, config.tenantId]
    );
    if (!row) return null;
    await assertHandoverMachineAccess(user, row.machine_code);

    const personName =
      patch.personName != null || patch.memberName != null
        ? String(patch.personName ?? patch.memberName).trim()
        : row.person_name;
    if (!personName) throw Object.assign(new Error('personName required'), { status: 400 });

    const roleLabel =
      patch.roleLabel != null ? String(patch.roleLabel).trim() || row.role_label : row.role_label;
    const shiftCode =
      patch.shiftCode != null ? String(patch.shiftCode) : row.shift_code;

    const updated = await queryOne(
      `UPDATE master.machine_crew_roster
       SET person_name = $3, role_label = $4, shift_code = $5, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
       RETURNING *`,
      [crewId, config.tenantId, personName, roleLabel, shiftCode]
    );
    if (updated) operatorNameCache.delete(updated.machine_code);
    return updated ? mapRow(updated) : null;
  } catch (e) {
    if (isMissingRelation(e)) throw new RosterTableMissingError();
    throw e;
  }
}

export async function removeCrew(user, id, machineCode) {
  try {
    const row = await queryOne(
      `SELECT * FROM master.machine_crew_roster WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, config.tenantId]
    );
    if (!row) return null;
    if (machineCode && machineCode !== row.machine_code) {
      const err = new Error('machineCode does not match roster row');
      err.status = 400;
      throw err;
    }
    await assertHandoverMachineAccess(user, row.machine_code);
    const updated = await queryOne(
      `UPDATE master.machine_crew_roster
       SET is_active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, config.tenantId]
    );
    if (updated) operatorNameCache.delete(updated.machine_code);
    return updated ? mapRow(updated) : null;
  } catch (e) {
    if (isMissingRelation(e)) throw new RosterTableMissingError();
    throw e;
  }
}

export async function getOperatorName(machineCode) {
  const cached = operatorNameCache.get(machineCode);
  if (cached && Date.now() - cached.at < OPERATOR_NAME_CACHE_TTL_MS) {
    return cached.name;
  }
  try {
    const row = await queryOne(
      `SELECT person_name FROM master.machine_crew_roster
       WHERE tenant_id = $1 AND machine_code = $2 AND is_active = true
         AND role_label ~* 'operator'
       ORDER BY person_name
       LIMIT 1`,
      [config.tenantId, machineCode]
    );
    const name = row?.person_name ?? null;
    operatorNameCache.set(machineCode, { name, at: Date.now() });
    return name;
  } catch (e) {
    if (isMissingRelation(e)) return null;
    throw e;
  }
}

export async function getOperatorNames(machineCodes = []) {
  const codes = [...new Set((machineCodes ?? []).filter(Boolean))];
  const out = {};
  await Promise.all(
    codes.map(async (code) => {
      out[code] = await getOperatorName(code);
    })
  );
  return out;
}
