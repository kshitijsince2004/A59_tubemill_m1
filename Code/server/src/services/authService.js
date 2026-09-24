import crypto from 'crypto';
import { pickPrimaryRole } from '@a59/shared';
import { query, queryOne } from '../db/pool';
import { config } from '../config';
import {
  clearFailState,
  isPinLocked,
  isValidPinFormat,
  nextFailState,
  verifyPin } from
'./pinService';
import { EmailPassword, Session, SuperTokens } from '../config/authConfig';














async function loadRoles(userId) {
  const rows = await query(
    `SELECT role_code FROM security.user_role WHERE user_id = $1 AND tenant_id = $2`,
    [userId, config.tenantId]
  );
  return rows.map((r) => r.role_code);
}

async function loadProcessAccess(userId) {
  const rows = await query(
    `SELECT process_code, access_level FROM security.process_access WHERE user_id = $1 AND tenant_id = $2`,
    [userId, config.tenantId]
  );
  return rows.map((r) => ({
    processCode: r.process_code,
    level: r.access_level
  }));
}

async function loadMachineAccess(userId) {
  const rows = await query(
    `SELECT machine_code, access_level FROM security.machine_access WHERE user_id = $1 AND tenant_id = $2`,
    [userId, config.tenantId]
  );
  return rows.map((r) => ({
    machineCode: r.machine_code,
    level: r.access_level
  }));
}

export async function toSessionUser(row) {
  const roles = await loadRoles(row.user_id);
  const processAccess = await loadProcessAccess(row.user_id);
  const machineAccess = await loadMachineAccess(row.user_id);
  const primaryRole = pickPrimaryRole(roles.length ? roles : ['OPERATOR']);
  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    empCode: row.emp_code,
    email: row.email,
    roles: roles.length ? roles : [primaryRole],
    primaryRole,
    processAccess,
    machineAccess
  };
}

export async function loadGrantsByUserId(userId) {
  const row = await queryOne(
    `SELECT user_id, username, full_name, emp_code, email, pin_hash, status,
            supertokens_user_id, pin_fail_count, pin_locked_until
     FROM security.app_user WHERE user_id = $1 AND tenant_id = $2`,
    [userId, config.tenantId]
  );
  if (!row || row.status !== 'ACTIVE') return null;
  return toSessionUser(row);
}

export async function loadGrantsBySuperTokensUserId(
stUserId)
{
  const row = await queryOne(
    `SELECT user_id, username, full_name, emp_code, email, pin_hash, status,
            supertokens_user_id, pin_fail_count, pin_locked_until
     FROM security.app_user WHERE supertokens_user_id = $1 AND tenant_id = $2`,
    [stUserId, config.tenantId]
  );
  if (!row || row.status !== 'ACTIVE') return null;
  return toSessionUser(row);
}

export async function ensureSuperTokensUser(
row,
password)
{
  if (!config.superTokensEnabled) {
    throw new Error('SuperTokens is not enabled');
  }
  if (row.supertokens_user_id) return row.supertokens_user_id;

  const email =
  row.email?.trim().toLowerCase() ||
  `${(row.emp_code || row.username).toLowerCase().replace(/[^a-z0-9._-]/g, '')}@a59.local`;

  // Explicit password from admin provisioning, else unguessable one-time secret.
  // Never derive from user_id or ship demo password maps (audit F3).
  const pwd = password || crypto.randomBytes(32).toString('base64url');

  let stUserId = null;
  const signUp = await EmailPassword.signUp('public', email, pwd);
  if (signUp.status === 'OK') {
    stUserId = signUp.user.id;
  } else {
    const existing = await SuperTokens.listUsersByAccountInfo('public', { email });
    stUserId = existing[0]?.id ?? null;
  }
  if (!stUserId) {
    throw new Error(`Could not provision SuperTokens user for ${email}`);
  }

  await query(
    `UPDATE security.app_user SET supertokens_user_id = $1, email = COALESCE(email, $2), updated_at = now()
     WHERE user_id = $3 AND tenant_id = $4`,
    [stUserId, email, row.user_id, config.tenantId]
  );
  return stUserId;
}





export async function validateBadgePin(empCode, pin) {
  if (!empCode.trim() || !isValidPinFormat(pin)) {
    return { ok: false, message: 'Badge and 4-digit PIN required', status: 400 };
  }

  const row = await queryOne(
    `SELECT user_id, username, full_name, emp_code, email, pin_hash, status,
            supertokens_user_id, pin_fail_count, pin_locked_until
     FROM security.app_user
     WHERE tenant_id = $1 AND upper(emp_code) = upper($2)`,
    [config.tenantId, empCode.trim()]
  );

  if (!row) {
    return { ok: false, message: 'Invalid badge or PIN', status: 401 };
  }
  if (row.status !== 'ACTIVE') {
    return { ok: false, message: 'User disabled', status: 403 };
  }
  if (isPinLocked(row)) {
    return { ok: false, message: 'PIN locked — try again later', status: 423 };
  }

  const match = await verifyPin(pin, row.pin_hash);
  if (!match) {
    const next = nextFailState(row);
    await query(
      `UPDATE security.app_user SET pin_fail_count = $1, pin_locked_until = $2, updated_at = now()
       WHERE user_id = $3 AND tenant_id = $4`,
      [next.pin_fail_count, next.pin_locked_until, row.user_id, config.tenantId]
    );
    return { ok: false, message: 'Invalid badge or PIN', status: 401 };
  }

  const cleared = clearFailState();
  await query(
    `UPDATE security.app_user SET pin_fail_count = $1, pin_locked_until = NULL, updated_at = now()
     WHERE user_id = $2 AND tenant_id = $3`,
    [cleared.pin_fail_count, row.user_id, config.tenantId]
  );

  let stUserId = row.supertokens_user_id;
  if (config.superTokensEnabled) {
    stUserId = await ensureSuperTokensUser({ ...row, pin_fail_count: 0, pin_locked_until: null });
  } else {
    stUserId = row.user_id;
  }

  const user = await toSessionUser(row);
  return { ok: true, user, stUserId: stUserId };
}

export async function verifySessionPin(
userId,
pin)
{
  if (!isValidPinFormat(pin)) {
    return { ok: false, message: 'PIN must be 4 digits', status: 400 };
  }
  const row = await queryOne(
    `SELECT user_id, username, full_name, emp_code, email, pin_hash, status,
            supertokens_user_id, pin_fail_count, pin_locked_until
     FROM security.app_user WHERE user_id = $1 AND tenant_id = $2`,
    [userId, config.tenantId]
  );
  if (!row || row.status !== 'ACTIVE') {
    return { ok: false, message: 'User not found', status: 404 };
  }
  if (isPinLocked(row)) {
    return { ok: false, message: 'PIN locked — try again later', status: 423 };
  }
  const match = await verifyPin(pin, row.pin_hash);
  if (!match) {
    const next = nextFailState(row);
    await query(
      `UPDATE security.app_user SET pin_fail_count = $1, pin_locked_until = $2, updated_at = now()
       WHERE user_id = $3 AND tenant_id = $4`,
      [next.pin_fail_count, next.pin_locked_until, row.user_id, config.tenantId]
    );
    return { ok: false, message: 'Invalid PIN', status: 401 };
  }
  const cleared = clearFailState();
  await query(
    `UPDATE security.app_user SET pin_fail_count = $1, pin_locked_until = NULL, updated_at = now()
     WHERE user_id = $2 AND tenant_id = $3`,
    [cleared.pin_fail_count, row.user_id, config.tenantId]
  );
  return { ok: true };
}

/** Roles authorized to grant supervisor-override PIN (mechanism name preserved). */
export const OVERRIDE_ROLES = ['MACHINE_HEAD', 'PLANT_HEAD', 'ADMIN'];

const OVERRIDE_TTL_MS = 5 * 60 * 1000;

function overrideSigningKey() {
  return config.serviceToken || 'dev-service-token';
}

/**
 * Issue a short-lived scoped override token bound to action + resource (audit F10).
 * @param {{ grantedBy: string, action: string, resourceId?: string | null }} input
 */
export function issueOverrideToken(input) {
  const expiresAt = new Date(Date.now() + OVERRIDE_TTL_MS).toISOString();
  const body = {
    grantedBy: input.grantedBy,
    action: String(input.action || 'APPROVE').toUpperCase(),
    resourceId: input.resourceId ? String(input.resourceId) : null,
    exp: expiresAt,
  };
  const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', overrideSigningKey()).update(payload).digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt, action: body.action, resourceId: body.resourceId };
}

/**
 * Verify an override token for a specific action and optional resource id.
 * @returns {{ grantedBy: string, action: string, resourceId: string | null } | null}
 */
export function verifyOverrideToken(token, expected) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', overrideSigningKey()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let body;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!body?.exp || new Date(body.exp).getTime() < Date.now()) return null;
  const action = String(expected?.action || 'APPROVE').toUpperCase();
  if (String(body.action || '').toUpperCase() !== action) return null;
  if (expected?.resourceId != null && body.resourceId != null && String(body.resourceId) !== String(expected.resourceId)) {
    return null;
  }
  return {
    grantedBy: String(body.grantedBy),
    action: String(body.action).toUpperCase(),
    resourceId: body.resourceId ?? null,
  };
}

/**
 * Verify badge+PIN of an override authority. KEEP name verifySupervisorOverridePin.
 * @param {string} empCode
 * @param {string} pin
 * @param {{ action?: string, resourceId?: string }} [scope]
 */
export async function verifySupervisorOverridePin(empCode, pin, scope = {}) {
  if (!empCode?.trim() || !isValidPinFormat(pin)) {
    return { ok: false, message: 'Badge and 4-digit PIN required', status: 400 };
  }
  const action = String(scope.action || 'APPROVE').toUpperCase();
  if (!action) {
    return { ok: false, message: 'Override action is required', status: 400 };
  }
  const row = await queryOne(
    `SELECT user_id, username, full_name, emp_code, email, pin_hash, status,
            supertokens_user_id, pin_fail_count, pin_locked_until
     FROM security.app_user
     WHERE tenant_id = $1 AND (emp_code = $2 OR username = $2)`,
    [config.tenantId, empCode.trim()]
  );
  if (!row || row.status !== 'ACTIVE') {
    return { ok: false, message: 'User not found', status: 404 };
  }
  if (isPinLocked(row)) {
    return { ok: false, message: 'PIN locked — try again later', status: 423 };
  }
  const match = await verifyPin(pin, row.pin_hash);
  if (!match) {
    const next = nextFailState(row);
    await query(
      `UPDATE security.app_user SET pin_fail_count = $1, pin_locked_until = $2, updated_at = now()
       WHERE user_id = $3 AND tenant_id = $4`,
      [next.pin_fail_count, next.pin_locked_until, row.user_id, config.tenantId]
    );
    return { ok: false, message: 'Invalid PIN', status: 401 };
  }
  const roles = await loadRoles(row.user_id);
  if (!roles.some((r) => OVERRIDE_ROLES.includes(r))) {
    return { ok: false, message: 'Override requires MACHINE_HEAD, PLANT_HEAD, or ADMIN', status: 403 };
  }
  const cleared = clearFailState();
  await query(
    `UPDATE security.app_user SET pin_fail_count = $1, pin_locked_until = NULL, updated_at = now()
     WHERE user_id = $2 AND tenant_id = $3`,
    [cleared.pin_fail_count, row.user_id, config.tenantId]
  );
  const issued = issueOverrideToken({
    grantedBy: row.user_id,
    action,
    resourceId: scope.resourceId ?? null,
  });
  return {
    ok: true,
    override: {
      token: issued.token,
      expiresAt: issued.expiresAt,
      action: issued.action,
      resourceId: issued.resourceId,
      grantedBy: row.user_id,
      empCode: row.emp_code,
      at: new Date().toISOString(),
    },
  };
}

export { Session };