import { query, queryOne } from '../db/pool';
import { config } from '../config';

async function sessionNeedsCrew(sessionId) {
  const row = await queryOne(
    `SELECT 1 AS x FROM txn.session_crew
     WHERE tenant_id = $1 AND session_id = $2
     LIMIT 1`,
    [config.tenantId, sessionId]
  );
  return !row;
}

function todayIstDate() {
  // Approximate IST calendar date for prod_date (UTC+5:30)
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function mapSession(row) {
  if (!row) return null;
  return {
    sessionId: row.id,
    id: row.id,
    machineCode: row.machine_code,
    shiftCode: row.shift_code,
    prodDate: row.prod_date,
    operatorUserId: row.operator_user_id,
    shiftLogId: row.shift_log_id,
    status: row.status,
    startedAt: row.started_at,
    closedAt: row.closed_at,
  };
}

function mapShiftLog(row) {
  if (!row) return null;
  return {
    shiftLogId: row.id,
    id: row.id,
    machineCode: row.machine_code,
    shiftCode: row.shift_code,
    prodDate: row.prod_date,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

async function findOrOpenShiftLog(machineCode, shiftCode, prodDate) {
  const existing = await queryOne(
    `SELECT * FROM txn.shift_log
     WHERE tenant_id = $1 AND machine_code = $2 AND shift_code = $3
       AND prod_date = $4::date AND status = 'OPEN'
     LIMIT 1`,
    [config.tenantId, machineCode, shiftCode, prodDate]
  );
  if (existing) return existing;

  try {
    const rows = await query(
      `INSERT INTO txn.shift_log (
         tenant_id, machine_code, shift_code, prod_date, status
       ) VALUES ($1,$2,$3,$4::date,'OPEN')
       RETURNING *`,
      [config.tenantId, machineCode, shiftCode, prodDate]
    );
    if (rows[0]) return rows[0];
  } catch (e) {
    // Concurrent open — fall through to re-select
    if (e?.code !== '23505') throw e;
  }

  return queryOne(
    `SELECT * FROM txn.shift_log
     WHERE tenant_id = $1 AND machine_code = $2 AND shift_code = $3
       AND prod_date = $4::date AND status = 'OPEN'
     LIMIT 1`,
    [config.tenantId, machineCode, shiftCode, prodDate]
  );
}

/**
 * Start or resume an ACTIVE machine shift session for the operator.
 * Soft-mandatory crew: returns needsCrew when no session_crew rows exist.
 * Blocks when a PENDING handover is unaccepted (incoming must accept first).
 *
 * Takeover (closes another operator's ACTIVE session): enabled when
 * SESSION_ALLOW_TAKEOVER=true, AUTH_ALLOW_HEADER_ROLE=true, or caller is ADMIN.
 */
export async function ensureActiveSession(user, machineCode, opts = {}) {
  if (!user?.userId) {
    const err = new Error('Unauthenticated');
    err.status = 401;
    throw err;
  }
  const code = String(machineCode ?? '').trim();
  if (!code) {
    const err = new Error('machineCode required');
    err.status = 400;
    throw err;
  }

  const known = await queryOne(
    `SELECT machine_code FROM master.machine
     WHERE tenant_id = $1 AND machine_code = $2`,
    [config.tenantId, code]
  );
  if (!known) {
    const err = new Error(`Unknown machine ${code}`);
    err.status = 400;
    err.code = 'UNKNOWN_MACHINE';
    throw err;
  }

  const shiftCode = String(opts.shiftCode ?? 'A');
  const prodDate = opts.prodDate ?? todayIstDate();
  const operatorId = String(user.userId);
  const roles = Array.isArray(user.roles) ? user.roles.map((r) => String(r).toUpperCase()) : [];
  const allowTakeover =
    process.env.SESSION_ALLOW_TAKEOVER === 'true' ||
    process.env.AUTH_ALLOW_HEADER_ROLE === 'true' ||
    roles.includes('ADMIN');

  const pending = await queryOne(
    `SELECT handover_id, machine_code, status, outgoing_operator_id, remarks,
            outgoing_shift_code, incoming_shift_code, created_at
     FROM txn.machine_handover
     WHERE tenant_id = $1 AND machine_code = $2 AND status = 'PENDING'
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, code]
  );

  const active = await queryOne(
    `SELECT * FROM txn.machine_shift_session
     WHERE tenant_id = $1 AND machine_code = $2 AND status = 'ACTIVE'
     LIMIT 1`,
    [config.tenantId, code]
  );

  if (active) {
    if (String(active.operator_user_id) === operatorId) {
      const shiftLog = await queryOne(
        `SELECT * FROM txn.shift_log WHERE id = $1 AND tenant_id = $2`,
        [active.shift_log_id, config.tenantId]
      );
      const needsCrew = await sessionNeedsCrew(active.id);
      return {
        session: mapSession(active),
        shiftLog: mapShiftLog(shiftLog),
        needsCrew,
        pending: null,
      };
    }

    if (!allowTakeover) {
      const err = new Error('ACTIVE_SESSION_CONFLICT');
      err.status = 409;
      err.code = 'ACTIVE_SESSION_CONFLICT';
      throw err;
    }

    await closeSession(active.id);
  }

  if (pending) {
    const err = new Error(
      'PENDING_HANDOVER: Accept the pending handover before starting a session on this machine.'
    );
    err.status = 409;
    err.code = 'PENDING_HANDOVER';
    err.pending = pending;
    throw err;
  }

  const shiftLog = await findOrOpenShiftLog(code, shiftCode, prodDate);
  if (!shiftLog) {
    const err = new Error('Could not open shift log');
    err.status = 500;
    throw err;
  }

  const rows = await query(
    `INSERT INTO txn.machine_shift_session (
       tenant_id, machine_code, shift_code, prod_date,
       operator_user_id, shift_log_id, status
     ) VALUES ($1,$2,$3,$4::date,$5,$6,'ACTIVE')
     RETURNING *`,
    [config.tenantId, code, shiftCode, prodDate, operatorId, shiftLog.id]
  );

  const session = rows[0];
  const needsCrew = await sessionNeedsCrew(session.id);
  return {
    session: mapSession(session),
    shiftLog: mapShiftLog(shiftLog),
    needsCrew,
    pending: null,
  };
}

export async function getActiveSession(machineCode) {
  const row = await queryOne(
    `SELECT * FROM txn.machine_shift_session
     WHERE tenant_id = $1 AND machine_code = $2 AND status = 'ACTIVE'
     LIMIT 1`,
    [config.tenantId, machineCode]
  );
  return mapSession(row);
}

export async function closeSession(sessionId) {
  const row = await queryOne(
    `UPDATE txn.machine_shift_session
     SET status = 'CLOSED', closed_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'ACTIVE'
     RETURNING *`,
    [sessionId, config.tenantId]
  );
  return mapSession(row);
}

/** Best-effort: close all ACTIVE sessions owned by this operator (sign-out / shift end). */
export async function closeActiveSessionsForOperator(operatorUserId) {
  if (!operatorUserId) return [];
  const rows = await query(
    `UPDATE txn.machine_shift_session
     SET status = 'CLOSED', closed_at = now(), updated_at = now()
     WHERE tenant_id = $1 AND operator_user_id = $2 AND status = 'ACTIVE'
     RETURNING *`,
    [config.tenantId, String(operatorUserId)]
  );
  return rows.map(mapSession);
}
