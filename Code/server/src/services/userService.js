import { ensureSuperTokensUser, toSessionUser } from './authService';

import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { hashPin, isValidPinFormat } from './pinService';
import { recordAuditEvent } from './AuditTrailService';

// EmailPassword import removed — provisioning goes through ensureSuperTokensUser


























const STAFF_ROLES = ['ADMIN', 'MACHINE_HEAD', 'PLANT_HEAD'];

export function isStaffRole(roles) {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

export async function listUsers() {
  const rows = await query(
    `SELECT user_id, username, full_name, emp_code, email, pin_hash, status,
            supertokens_user_id, pin_fail_count, pin_locked_until
     FROM security.app_user WHERE tenant_id = $1 ORDER BY username`,
    [config.tenantId]
  );
  const out = [];
  for (const row of rows) {
    const session = await toSessionUser(row);
    out.push({
      userId: session.userId,
      username: session.username,
      fullName: session.fullName,
      empCode: session.empCode,
      email: session.email,
      status: row.status,
      roles: session.roles,
      processAccess: session.processAccess,
      machineAccess: session.machineAccess
    });
  }
  return out;
}















export async function upsertUser(input) {
  const roles = input.roles.length ? input.roles : ['OPERATOR'];
  let pinHash;
  if (input.pin != null && input.pin !== '') {
    if (!isValidPinFormat(input.pin)) throw new Error('PIN must be exactly 4 digits');
    pinHash = await hashPin(input.pin);
  }

  let userId = input.userId;
  if (userId) {
    await query(
      `UPDATE security.app_user SET
         username = $1, full_name = $2, emp_code = $3, email = $4, status = $5,
         pin_hash = COALESCE($6, pin_hash), updated_at = now()
       WHERE user_id = $7 AND tenant_id = $8`,
      [
      input.username.trim(),
      input.fullName.trim(),
      input.empCode?.trim() || null,
      input.email?.trim().toLowerCase() || null,
      input.status ?? 'ACTIVE',
      pinHash ?? null,
      userId,
      config.tenantId]

    );
  } else {
    const inserted = await queryOne(
      `INSERT INTO security.app_user (
         tenant_id, username, full_name, emp_code, email, pin_hash, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING user_id`,
      [
      config.tenantId,
      input.username.trim(),
      input.fullName.trim(),
      input.empCode?.trim() || null,
      input.email?.trim().toLowerCase() || null,
      pinHash ?? null,
      input.status ?? 'ACTIVE']

    );
    userId = inserted.user_id;
  }

  await query(`DELETE FROM security.user_role WHERE user_id = $1 AND tenant_id = $2`, [
  userId,
  config.tenantId]
  );
  for (const role of roles) {
    await query(
      `INSERT INTO security.user_role (user_id, role_code, tenant_id) VALUES ($1,$2,$3)`,
      [userId, role, config.tenantId]
    );
  }

  if (input.processAccess) {
    await query(`DELETE FROM security.process_access WHERE user_id = $1 AND tenant_id = $2`, [
    userId,
    config.tenantId]
    );
    for (const g of input.processAccess) {
      await query(
        `INSERT INTO security.process_access (user_id, process_code, access_level, tenant_id)
         VALUES ($1,$2,$3,$4)`,
        [userId, g.processCode, g.level, config.tenantId]
      );
    }
  }

  if (input.machineAccess) {
    await query(`DELETE FROM security.machine_access WHERE user_id = $1 AND tenant_id = $2`, [
    userId,
    config.tenantId]
    );
    for (const g of input.machineAccess) {
      await query(
        `INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
         VALUES ($1,$2,$3,$4)`,
        [userId, g.machineCode, g.level, config.tenantId]
      );
    }
  }

  const row = await queryOne(
    `SELECT user_id, username, full_name, emp_code, email, pin_hash, status,
            supertokens_user_id, pin_fail_count, pin_locked_until
     FROM security.app_user WHERE user_id = $1 AND tenant_id = $2`,
    [userId, config.tenantId]
  );
  if (!row) throw new Error('User not found after upsert');

  if (config.superTokensEnabled && (isStaffRole(roles) || row.email)) {
    const password = input.password || undefined;
    await ensureSuperTokensUser(row, password);
  }

  // Use toSessionUser (not loadGrantsByUserId) so INACTIVE users can still be edited/returned
  const session = await toSessionUser(row);
  const result = {
    userId: session.userId,
    username: session.username,
    fullName: session.fullName,
    empCode: session.empCode,
    email: session.email,
    status: row.status,
    roles: session.roles,
    processAccess: session.processAccess,
    machineAccess: session.machineAccess
  };
  await recordAuditEvent({
    action: input.userId ? 'USER_UPDATE' : 'USER_CREATE',
    entityType: 'USER',
    entityId: String(userId),
    detail: { username: result.username, roles: result.roles },
  });
  return result;
}

export async function setProcessAccess(
userId,
grants)
{
  await query(`DELETE FROM security.process_access WHERE user_id = $1 AND tenant_id = $2`, [
  userId,
  config.tenantId]
  );
  for (const g of grants) {
    await query(
      `INSERT INTO security.process_access (user_id, process_code, access_level, tenant_id)
       VALUES ($1,$2,$3,$4)`,
      [userId, g.processCode, g.level, config.tenantId]
    );
  }
}

export async function setMachineAccess(
userId,
grants)
{
  await query(`DELETE FROM security.machine_access WHERE user_id = $1 AND tenant_id = $2`, [
  userId,
  config.tenantId]
  );
  for (const g of grants) {
    await query(
      `INSERT INTO security.machine_access (user_id, machine_code, access_level, tenant_id)
       VALUES ($1,$2,$3,$4)`,
      [userId, g.machineCode, g.level, config.tenantId]
    );
  }
}

export async function listMachines()
{
  const rows = await query(
    `SELECT machine_code, label, process_code FROM master.machine WHERE tenant_id = $1 ORDER BY process_code, machine_code`,
    [config.tenantId]
  );
  return rows.map((r) => ({
    machineCode: r.machine_code,
    label: r.label,
    processCode: r.process_code
  }));
}

export async function createMachine({ machineCode, label, processCode }) {
  const code = String(machineCode ?? '').trim();
  const lbl = String(label ?? '').trim();
  const proc = String(processCode ?? '').trim();
  if (!code || !lbl || !proc) {
    const err = new Error('machineCode, label, and processCode are required');
    err.status = 400;
    throw err;
  }
  await query(
    `INSERT INTO master.machine (machine_code, tenant_id, label, process_code)
     VALUES ($1, $2, $3, $4)`,
    [code, config.tenantId, lbl, proc]
  );
  return { machineCode: code, label: lbl, processCode: proc };
}

export async function updateMachine(
machineCode,
patch)
{
  if (patch.label != null) {
    await query(
      `UPDATE master.machine SET label = $1 WHERE machine_code = $2 AND tenant_id = $3`,
      [patch.label, machineCode, config.tenantId]
    );
  }
  if (patch.processCode != null) {
    await query(
      `UPDATE master.machine SET process_code = $1 WHERE machine_code = $2 AND tenant_id = $3`,
      [patch.processCode, machineCode, config.tenantId]
    );
  }
}