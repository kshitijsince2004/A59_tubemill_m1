import { query, queryOne } from '../db/pool';
import { config } from '../config';
import { addCrew } from './MachineCrewService';

export const VALID_ROLE_CODES = [
  'OPERATOR',
  'ASST',
  'HELPER',
  'CRANE',
  'MTL',
  'SHIFT_INCHARGE',
  'SHIFT_MANAGER',
];

function mapCrewJoin(row) {
  return {
    sessionCrewId: row.session_crew_id ?? row.id,
    id: row.session_crew_id ?? row.id,
    sessionId: row.session_id,
    crewId: row.crew_id,
    memberName: row.person_name,
    personName: row.person_name,
    roleLabel: row.role_label,
    machineCode: row.machine_code,
    shiftCode: row.shift_code,
  };
}

export async function sessionNeedsCrew(sessionId) {
  const row = await queryOne(
    `SELECT 1 AS x FROM txn.session_crew
     WHERE tenant_id = $1 AND session_id = $2
     LIMIT 1`,
    [config.tenantId, sessionId]
  );
  return !row;
}

export async function listBySession(sessionId) {
  const rows = await query(
    `SELECT sc.id AS session_crew_id, sc.session_id, sc.crew_id,
            r.person_name, r.role_label, r.machine_code, r.shift_code
     FROM txn.session_crew sc
     JOIN master.machine_crew_roster r ON r.id = sc.crew_id
     WHERE sc.tenant_id = $1 AND sc.session_id = $2
     ORDER BY r.role_label, r.person_name`,
    [config.tenantId, sessionId]
  );
  return rows.map(mapCrewJoin);
}

export async function listByShiftLog(shiftLogId) {
  const rows = await query(
    `SELECT sc.id AS session_crew_id, sc.session_id, sc.crew_id,
            r.person_name, r.role_label, r.machine_code, r.shift_code
     FROM txn.session_crew sc
     JOIN txn.machine_shift_session s ON s.id = sc.session_id
     JOIN master.machine_crew_roster r ON r.id = sc.crew_id
     WHERE sc.tenant_id = $1 AND s.shift_log_id = $2
     ORDER BY r.role_label, r.person_name`,
    [config.tenantId, shiftLogId]
  );
  return rows.map(mapCrewJoin);
}

/**
 * Attach roster members to a session. Idempotent on crew_id.
 */
export async function attachRosterToSession(sessionId, crewIds = []) {
  const ids = [...new Set((crewIds ?? []).filter(Boolean).map(String))];
  if (!sessionId) {
    const err = new Error('sessionId required');
    err.status = 400;
    throw err;
  }
  if (!ids.length) {
    const err = new Error('crewIds required');
    err.status = 400;
    throw err;
  }

  const session = await queryOne(
    `SELECT * FROM txn.machine_shift_session WHERE id = $1 AND tenant_id = $2`,
    [sessionId, config.tenantId]
  );
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  for (const crewId of ids) {
    const roster = await queryOne(
      `SELECT id FROM master.machine_crew_roster
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
         AND machine_code = $3`,
      [crewId, config.tenantId, session.machine_code]
    );
    if (!roster) continue;
    await query(
      `INSERT INTO txn.session_crew (tenant_id, session_id, crew_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (session_id, crew_id) DO NOTHING`,
      [config.tenantId, sessionId, crewId]
    );
  }

  return listBySession(sessionId);
}

/**
 * Resolve or create a roster entry for the operator, then attach to the
 * active session for the given shift log.
 */
export async function create({ shiftLogId, operatorId, roleCode, memberName, machineCode }) {
  const code = String(roleCode ?? 'OPERATOR').toUpperCase();
  if (!VALID_ROLE_CODES.includes(code)) {
    const err = new Error(`Invalid roleCode; expected one of ${VALID_ROLE_CODES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const shiftLog = await queryOne(
    `SELECT * FROM txn.shift_log WHERE id = $1 AND tenant_id = $2`,
    [shiftLogId, config.tenantId]
  );
  if (!shiftLog) {
    const err = new Error('Shift log not found');
    err.status = 404;
    throw err;
  }

  const mCode = machineCode || shiftLog.machine_code;
  const name = String(memberName || operatorId || 'Operator').trim();

  let roster = await queryOne(
    `SELECT * FROM master.machine_crew_roster
     WHERE tenant_id = $1 AND machine_code = $2 AND is_active = true
       AND lower(person_name) = lower($3)
     LIMIT 1`,
    [config.tenantId, mCode, name]
  );

  if (!roster) {
    const created = await addCrew({
      machineCode: mCode,
      personName: name,
      roleLabel: code,
      shiftCode: shiftLog.shift_code,
    });
    roster = { id: created.id };
  }

  const session = await queryOne(
    `SELECT * FROM txn.machine_shift_session
     WHERE tenant_id = $1 AND shift_log_id = $2 AND status = 'ACTIVE'
     ORDER BY started_at DESC
     LIMIT 1`,
    [config.tenantId, shiftLogId]
  );
  if (!session) {
    const err = new Error('No active session for shift log');
    err.status = 400;
    throw err;
  }

  await attachRosterToSession(session.id, [roster.id]);
  const list = await listBySession(session.id);
  return list.find((c) => c.crewId === roster.id) ?? list[0] ?? null;
}

/** Pick display names for DPR footers from session crew. */
export function pickCrewFooterNames(crewList = []) {
  const byRole = (re) =>
    crewList.find((c) => re.test(String(c.roleLabel ?? '')))?.personName ?? null;
  const incharge =
    byRole(/SHIFT_INCHARGE|SHIFT_MANAGER|incharge|in-charge/i) ||
    byRole(/^OPERATOR$/i) ||
    byRole(/operator/i) ||
    crewList[0]?.personName ||
    '';
  const supervisor =
    byRole(/SHIFT_MANAGER|supervisor|SHIFT_INCHARGE/i) ||
    incharge ||
    '';
  return {
    supervisor,
    incharge,
    crewNames: crewList.map((c) => c.personName).filter(Boolean),
    crew: crewList,
  };
}
