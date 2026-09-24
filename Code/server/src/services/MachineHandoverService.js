/**
 * Machine handover lifecycle — A59 port of Zedral MachineHandoverService.
 * Uses raw SQL + existing machine_shift_session / shift_log / crew.
 */

import { query, queryOne, withTransaction } from '../db/pool';
import { config } from '../config';
import { listBySession } from './CrewService';
import { listCrew } from './MachineCrewService';
import { reparentOpenWork } from './handover/carryForward';
import {
  resolveShiftFromClock,
  canCompleteOutgoingHandover,
  plantDateString,
} from './handover/shiftWindows';

const HANDOVER_MIN_REMARKS = 20;

const OPEN_STATUSES = `('DRAFT','OPEN','IN_PROGRESS','SUBMITTED')`;

function httpError(message, status = 400, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function normalizePriority(priority) {
  if (priority === 'LOW') return 'LOW';
  if (priority === 'HIGH' || priority === 'CRITICAL') return 'HIGH';
  return 'MEDIUM';
}

/** Normalize pg Date / string to YYYY-MM-DD */
function asDateOnly(value) {
  if (!value) return plantDateString();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return plantDateString();
}

function mapHandover(row) {
  if (!row) return null;
  return {
    handover_id: row.handover_id,
    handoverId: row.handover_id,
    machine_code: row.machine_code,
    machineCode: row.machine_code,
    process_code: row.process_code,
    processCode: row.process_code,
    batch_number: row.batch_number,
    outgoing_shift_code: row.outgoing_shift_code,
    incoming_shift_code: row.incoming_shift_code,
    outgoing_prod_date: row.outgoing_prod_date
      ? String(row.outgoing_prod_date).slice(0, 10)
      : null,
    incoming_prod_date: row.incoming_prod_date
      ? String(row.incoming_prod_date).slice(0, 10)
      : null,
    outgoing_operator_id: row.outgoing_operator_id,
    incoming_operator_id: row.incoming_operator_id,
    machine_status: row.machine_status,
    breakdown_code: row.breakdown_code,
    breakdown_description: row.breakdown_description,
    downtime_minutes: row.downtime_minutes,
    maintenance_status: row.maintenance_status,
    remarks: row.remarks,
    handover_priority: row.handover_priority,
    queue_snapshot: row.queue_snapshot ?? {},
    production_snapshot: row.production_snapshot ?? {},
    open_stoppages: row.open_stoppages ?? [],
    status: row.status,
    clarification_notes: row.clarification_notes,
    created_at: row.created_at,
    accepted_at: row.accepted_at,
    created_by_boundary: row.created_by_boundary,
  };
}

async function getMachine(machineCode, client) {
  return queryOne(
    `SELECT machine_code, label, process_code
     FROM master.machine
     WHERE machine_code = $1 AND tenant_id = $2`,
    [machineCode, config.tenantId],
    client
  );
}

async function getActiveSession(machineCode, client) {
  return queryOne(
    `SELECT * FROM txn.machine_shift_session
     WHERE tenant_id = $1 AND machine_code = $2 AND status = 'ACTIVE'
     LIMIT 1`,
    [config.tenantId, machineCode],
    client
  );
}

async function findOrOpenShiftLog(machineCode, shiftCode, prodDate, client) {
  const existing = await queryOne(
    `SELECT * FROM txn.shift_log
     WHERE tenant_id = $1 AND machine_code = $2 AND shift_code = $3
       AND prod_date = $4::date AND status = 'OPEN'
     LIMIT 1`,
    [config.tenantId, machineCode, shiftCode, prodDate],
    client
  );
  if (existing) return existing;

  try {
    const rows = await query(
      `INSERT INTO txn.shift_log (
         tenant_id, machine_code, shift_code, prod_date, status
       ) VALUES ($1,$2,$3,$4::date,'OPEN')
       RETURNING *`,
      [config.tenantId, machineCode, shiftCode, prodDate],
      client
    );
    if (rows[0]) return rows[0];
  } catch (e) {
    if (e?.code !== '23505') throw e;
  }

  return queryOne(
    `SELECT * FROM txn.shift_log
     WHERE tenant_id = $1 AND machine_code = $2 AND shift_code = $3
       AND prod_date = $4::date AND status = 'OPEN'
     LIMIT 1`,
    [config.tenantId, machineCode, shiftCode, prodDate],
    client
  );
}

async function closeShiftLog(shiftLogId, client) {
  if (!shiftLogId) return;
  await query(
    `UPDATE txn.shift_log
     SET status = 'CLOSED', closed_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'OPEN'`,
    [shiftLogId, config.tenantId],
    client
  );
}

async function loadOpenStoppages(machineCode, processCode) {
  const rows = await query(
    `SELECT id, stoppage_code, reason, from_time, mill_code, process_code, is_open
     FROM txn.stoppage_entry
     WHERE tenant_id = $1 AND is_open = true
       AND (
         mill_code = $2
         OR (process_code = $3 AND (mill_code IS NULL OR mill_code = $2))
       )
     ORDER BY from_time DESC
     LIMIT 50`,
    [config.tenantId, machineCode, processCode]
  );
  return rows.map((r) => ({
    stoppageId: r.id,
    startAt: r.from_time,
    reason: r.reason,
    category: r.stoppage_code,
    status: 'OPEN',
  }));
}

async function loadProductionSummary(machineCode, processCode, shiftLogId) {
  const code = String(processCode || '').toUpperCase();
  let openCount = 0;
  let openRows = [];

  if (code === 'TM') {
    openRows = await query(
      `SELECT id, run_no, run_state, status, work_order_no, total_prime_mt
       FROM txn.prod_tm_run
       WHERE tenant_id = $1 AND mill_code = $2
         AND run_state NOT IN ('RUN_COMPLETE','IDLE')
         AND status NOT IN ('LOCKED','APPROVED')
       ORDER BY created_at DESC LIMIT 20`,
      [config.tenantId, machineCode]
    );
    openCount = openRows.length;
  } else if (code === 'FUR') {
    openRows = await query(
      `SELECT id, charge_no, status, work_order_no, total_mt, furnace_code
       FROM txn.prod_ann_run
       WHERE tenant_id = $1 AND furnace_code = $2
         AND status IN ${OPEN_STATUSES}
       ORDER BY created_at DESC LIMIT 20`,
      [config.tenantId, machineCode]
    );
    openCount = openRows.length;
  } else if (code === 'STP') {
    openRows = await query(
      `SELECT id, lot_no, status, work_order_no, qty_mt, machine_code
       FROM txn.prod_stp_lot
       WHERE tenant_id = $1 AND machine_code = $2
         AND status IN ${OPEN_STATUSES}
       ORDER BY created_at DESC LIMIT 20`,
      [config.tenantId, machineCode]
    );
    openCount = openRows.length;
  } else if (code === 'DRW') {
    openRows = await query(
      `SELECT id, lot_no, status, work_order_no, accepted_mt AS qty_mt, bench_code
       FROM txn.prod_db_lot
       WHERE tenant_id = $1 AND bench_code = $2
         AND status IN ('DRAFT','HOLD')
       ORDER BY created_at DESC LIMIT 20`,
      [config.tenantId, machineCode]
    );
    openCount = openRows.length;
  }

  return {
    shiftLogId,
    openWorkCount: openCount,
    openWork: openRows,
    processCode: code,
  };
}

function buildProductionSnapshot(input, previewExtras) {
  return {
    machineCondition: input.machineCondition ?? 'NORMAL',
    machineConditionRemarks: input.machineConditionRemarks ?? null,
    crewNotes: input.crewNotes ?? null,
    selectedCrewMembers: previewExtras.selectedCrewMembers ?? [],
    shiftManualFields: {
      scrapKg: input.scrapKg ?? null,
      coolantTempDegC: input.coolantTempDegC ?? null,
      coolantPressKgCm2: input.coolantPressKgCm2 ?? null,
      shiftRemarks: input.shiftRemarks ?? null,
    },
    orderSnapshot: input.orderSnapshot ?? null,
    shiftProductionSummary: previewExtras.shiftProductionSummary ?? null,
    openWork: previewExtras.openWork ?? [],
    processExtras: previewExtras.processExtras ?? {},
  };
}

export async function listPendingForMachines(machineCodes) {
  const codes = [...new Set((machineCodes ?? []).filter(Boolean))];
  if (!codes.length) return [];
  const rows = await query(
    `SELECT * FROM txn.machine_handover
     WHERE tenant_id = $1 AND status = 'PENDING' AND machine_code = ANY($2::text[])
     ORDER BY created_at DESC`,
    [config.tenantId, codes]
  );
  return rows.map(mapHandover);
}

export async function getPendingForMachine(machineCode) {
  const row = await queryOne(
    `SELECT * FROM txn.machine_handover
     WHERE tenant_id = $1 AND machine_code = $2 AND status = 'PENDING'
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, machineCode]
  );
  return mapHandover(row);
}

export async function getDraftForMachine(machineCode, operatorUserId) {
  const row = await queryOne(
    `SELECT * FROM txn.machine_handover
     WHERE tenant_id = $1 AND machine_code = $2
       AND outgoing_operator_id = $3::uuid AND status = 'DRAFT'
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, machineCode, operatorUserId]
  );
  return mapHandover(row);
}

export async function getHandoverForAccess(handoverId) {
  const row = await queryOne(
    `SELECT handover_id, machine_code, status FROM txn.machine_handover
     WHERE tenant_id = $1 AND handover_id = $2`,
    [config.tenantId, handoverId]
  );
  return row;
}

/**
 * Block production mutations until incoming operator accepts pending handover
 * (unless this user already holds the ACTIVE session after accept).
 */
export async function assertProductionAllowed(machineCode, userId) {
  const pending = await getPendingForMachine(machineCode);
  if (!pending) return;

  const session = await queryOne(
    `SELECT id FROM txn.machine_shift_session
     WHERE tenant_id = $1 AND machine_code = $2
       AND operator_user_id = $3 AND status = 'ACTIVE'
     LIMIT 1`,
    [config.tenantId, machineCode, String(userId)]
  );
  if (session) return;

  throw httpError(
    'PENDING_HANDOVER: Accept the pending handover before changing production on this machine.',
    409,
    'PENDING_HANDOVER'
  );
}

export async function buildOutgoingPreview(machineCode, operatorUserId) {
  const machine = await getMachine(machineCode);
  if (!machine) throw httpError(`Machine ${machineCode} not found`, 404);

  const processCode = machine.process_code || machineCode;
  const clock = resolveShiftFromClock();
  const session = await getActiveSession(machineCode);
  const shiftLogId = session?.shift_log_id ?? null;

  const openStoppages = await loadOpenStoppages(machineCode, processCode);
  const prod = await loadProductionSummary(machineCode, processCode, shiftLogId);

  let crewSnapshot = [];
  if (session?.id) {
    try {
      crewSnapshot = await listBySession(session.id);
    } catch {
      crewSnapshot = [];
    }
  }

  let machineCrewRoster = [];
  try {
    machineCrewRoster = await listCrew(
      { roles: ['ADMIN'], machineAccess: [] },
      machineCode
    );
  } catch {
    machineCrewRoster = [];
  }

  const next = {
    shiftCode: clock.nextShiftCode,
    prodDate: clock.nextProdDate,
  };

  return {
    machineCode,
    machineName: machine.label || machineCode,
    processCode,
    shift: {
      shiftCode: session?.shift_code || clock.shiftCode,
      prodDate: session?.prod_date
        ? String(session.prod_date).slice(0, 10)
        : clock.prodDate,
      windowStart: clock.windowStart.toISOString(),
      windowEnd: clock.windowEnd.toISOString(),
      actualSessionStartAt: session?.started_at
        ? new Date(session.started_at).toISOString()
        : null,
      shiftLogId,
    },
    nextShift: next,
    openStoppages,
    productionSummary: prod,
    crewSnapshot,
    machineCrewRoster,
    canSubmit: canCompleteOutgoingHandover(clock),
  };
}

function parseOperatorUuid(operatorUserId) {
  const s = String(operatorUserId ?? '');
  // Allow static/dev users without a real uuid — store null for FK
  if (!/^[0-9a-f-]{36}$/i.test(s)) return null;
  return s;
}

async function resolveOperatorFk(operatorUserId, client) {
  const id = parseOperatorUuid(operatorUserId);
  if (!id) return null;
  const row = await queryOne(
    `SELECT user_id FROM security.app_user WHERE user_id = $1::uuid LIMIT 1`,
    [id],
    client
  );
  return row?.user_id ?? null;
}

async function upsertDraftOrPending(opts) {
  const {
    machineCode,
    operatorUserId,
    input,
    status,
    client,
  } = opts;

  const preview = await buildOutgoingPreview(machineCode, operatorUserId);
  const machine = await getMachine(machineCode, client);
  const processCode = machine?.process_code || machineCode;
  const clock = resolveShiftFromClock();
  const session = await getActiveSession(machineCode, client);

  const outgoingShift = session?.shift_code || clock.shiftCode;
  const outgoingDate = asDateOnly(session?.prod_date ?? clock.prodDate);

  let selectedCrewMembers = [];
  if (Array.isArray(input.selectedCrewIds) && input.selectedCrewIds.length) {
    const roster = preview.machineCrewRoster || [];
    selectedCrewMembers = roster
      .filter((r) => input.selectedCrewIds.includes(r.id) || input.selectedCrewIds.includes(r.crewId))
      .map((r) => ({
        id: r.id,
        memberName: r.memberName || r.personName,
        roleLabel: r.roleLabel,
      }));
  } else if (preview.crewSnapshot?.length) {
    selectedCrewMembers = preview.crewSnapshot.map((c) => ({
      id: c.crewId,
      memberName: c.memberName || c.personName,
      roleLabel: c.roleLabel,
    }));
  }

  const production_snapshot = buildProductionSnapshot(input, {
    selectedCrewMembers,
    shiftProductionSummary: {
      openWorkCount: preview.productionSummary?.openWorkCount ?? 0,
      totalStoppageMinutes: 0,
    },
    openWork: preview.productionSummary?.openWork ?? [],
    processExtras: input.processExtras ?? {},
  });

  const open_stoppages = preview.openStoppages;
  const remarks = String(input.remarks ?? '').trim() || (status === 'DRAFT' ? '(draft)' : '');
  const priority = normalizePriority(input.handoverPriority);
  const machineStatus = input.machineStatus || (open_stoppages.length ? 'STOPPAGE' : 'IDLE');
  const opId = await resolveOperatorFk(operatorUserId, client);

  const existingDraft = await queryOne(
    `SELECT handover_id FROM txn.machine_handover
     WHERE tenant_id = $1 AND machine_code = $2
       AND outgoing_operator_id IS NOT DISTINCT FROM $3::uuid
       AND status = 'DRAFT'
     ORDER BY created_at DESC LIMIT 1`,
    [config.tenantId, machineCode, opId],
    client
  );

  if (existingDraft && status === 'DRAFT') {
    const row = await queryOne(
      `UPDATE txn.machine_handover SET
         machine_status = $2,
         breakdown_code = $3,
         breakdown_description = $4,
         downtime_minutes = $5,
         maintenance_status = $6,
         remarks = $7,
         handover_priority = $8,
         production_snapshot = $9::jsonb,
         open_stoppages = $10::jsonb,
         queue_snapshot = $11::jsonb,
         outgoing_shift_code = $12,
         incoming_shift_code = $13,
         outgoing_prod_date = $14::date,
         incoming_prod_date = $15::date,
         process_code = $16,
         updated_at = now()
       WHERE handover_id = $1 AND tenant_id = $17
       RETURNING *`,
      [
        existingDraft.handover_id,
        machineStatus,
        input.breakdownCode ?? null,
        input.breakdownDescription ?? null,
        input.downtimeMinutes ?? null,
        input.maintenanceStatus ?? null,
        remarks,
        priority,
        JSON.stringify(production_snapshot),
        JSON.stringify(open_stoppages),
        JSON.stringify({}),
        outgoingShift,
        clock.nextShiftCode,
        outgoingDate,
        clock.nextProdDate,
        processCode,
        config.tenantId,
      ],
      client
    );
    return mapHandover(row);
  }

  if (status === 'PENDING' && existingDraft) {
    await query(
      `DELETE FROM txn.machine_handover WHERE handover_id = $1 AND tenant_id = $2`,
      [existingDraft.handover_id, config.tenantId],
      client
    );
  }

  const row = await queryOne(
    `INSERT INTO txn.machine_handover (
       tenant_id, machine_code, process_code, batch_number,
       outgoing_shift_code, incoming_shift_code,
       outgoing_prod_date, incoming_prod_date,
       outgoing_operator_id, machine_status,
       breakdown_code, breakdown_description, downtime_minutes, maintenance_status,
       remarks, handover_priority, production_snapshot, open_stoppages, queue_snapshot,
       status, created_by_boundary
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7::date,$8::date,$9::uuid,$10,
       $11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb,
       $20, false
     ) RETURNING *`,
    [
      config.tenantId,
      machineCode,
      processCode,
      input.batchNumber ?? null,
      outgoingShift,
      clock.nextShiftCode,
      outgoingDate,
      clock.nextProdDate,
      opId,
      machineStatus,
      input.breakdownCode ?? null,
      input.breakdownDescription ?? null,
      input.downtimeMinutes ?? null,
      input.maintenanceStatus ?? null,
      remarks,
      priority,
      JSON.stringify(production_snapshot),
      JSON.stringify(open_stoppages),
      JSON.stringify({}),
      status,
    ],
    client
  );
  return mapHandover(row);
}

export async function saveDraftHandover(machineCode, operatorUserId, input = {}) {
  return withTransaction(async (client) =>
    upsertDraftOrPending({
      machineCode,
      operatorUserId,
      input,
      status: 'DRAFT',
      client,
    })
  );
}

export async function createOutgoingHandover(machineCode, operatorUserId, input = {}) {
  const remarks = String(input.remarks ?? '').trim();
  if (remarks.length < HANDOVER_MIN_REMARKS) {
    throw httpError(`Remarks must be at least ${HANDOVER_MIN_REMARKS} characters`, 400);
  }

  const clock = resolveShiftFromClock();
  if (process.env.HANDOVER_ALLOW_EARLY !== 'true' && !canCompleteOutgoingHandover(clock)) {
    throw httpError(
      'Cannot submit handover before shift end. Wait until the scheduled shift window ends.',
      400,
      'HANDOVER_TOO_EARLY'
    );
  }

  return withTransaction(async (client) => {
    const pending = await queryOne(
      `SELECT handover_id FROM txn.machine_handover
       WHERE tenant_id = $1 AND machine_code = $2 AND status = 'PENDING'
       LIMIT 1`,
      [config.tenantId, machineCode],
      client
    );
    if (pending) {
      throw httpError('A pending handover already exists for this machine', 409, 'PENDING_EXISTS');
    }

    const session = await getActiveSession(machineCode, client);
    if (session && String(session.operator_user_id) !== String(operatorUserId)) {
      throw httpError('ACTIVE_SESSION_CONFLICT', 409, 'ACTIVE_SESSION_CONFLICT');
    }

    const handover = await upsertDraftOrPending({
      machineCode,
      operatorUserId,
      input: { ...input, remarks },
      status: 'PENDING',
      client,
    });

    if (session) {
      await query(
        `UPDATE txn.machine_shift_session
         SET status = 'CLOSED', closed_at = now(), updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
        [session.id, config.tenantId],
        client
      );
      await closeShiftLog(session.shift_log_id, client);
    }

    return handover;
  });
}

export async function getHandoverOverview(machineFilter) {
  const all = machineFilter == null;
  const codes = all ? null : [...new Set((machineFilter ?? []).filter(Boolean))];
  if (!all && (!codes || !codes.length)) {
    return { pending: [], recent: [], awaitingAcceptance: 0 };
  }

  const scopeClause = all
    ? ''
    : `AND h.machine_code = ANY($2::text[])`;
  const params = all ? [config.tenantId] : [config.tenantId, codes];

  const pending = await query(
    `SELECT h.*,
            ou.full_name AS outgoing_full_name, ou.username AS outgoing_username,
            iu.full_name AS incoming_full_name, iu.username AS incoming_username
     FROM txn.machine_handover h
     LEFT JOIN security.app_user ou ON ou.user_id = h.outgoing_operator_id
     LEFT JOIN security.app_user iu ON iu.user_id = h.incoming_operator_id
     WHERE h.tenant_id = $1 AND h.status = 'PENDING' ${scopeClause}
     ORDER BY h.created_at DESC LIMIT 50`,
    params
  );

  const recent = await query(
    `SELECT h.*,
            ou.full_name AS outgoing_full_name, ou.username AS outgoing_username,
            iu.full_name AS incoming_full_name, iu.username AS incoming_username
     FROM txn.machine_handover h
     LEFT JOIN security.app_user ou ON ou.user_id = h.outgoing_operator_id
     LEFT JOIN security.app_user iu ON iu.user_id = h.incoming_operator_id
     WHERE h.tenant_id = $1
       AND h.status IN ('ACCEPTED','CLARIFICATION_REQUESTED','AUTO_COMPLETED')
       ${scopeClause}
     ORDER BY COALESCE(h.accepted_at, h.created_at) DESC LIMIT 50`,
    params
  );

  return {
    pending: pending.map(mapHandover),
    recent: recent.map(mapHandover),
    awaitingAcceptance: pending.length,
  };
}

export async function acceptHandover(handoverId, incomingUserId) {
  return withTransaction(async (client) => {
    const updated = await queryOne(
      `UPDATE txn.machine_handover
       SET status = 'ACCEPTED',
           incoming_operator_id = $3::uuid,
           accepted_at = now(),
           updated_at = now()
       WHERE handover_id = $1 AND tenant_id = $2 AND status = 'PENDING'
       RETURNING *`,
      [handoverId, config.tenantId, await resolveOperatorFk(incomingUserId, client)],
      client
    );

    if (!updated) {
      const existing = await queryOne(
        `SELECT * FROM txn.machine_handover
         WHERE handover_id = $1 AND tenant_id = $2`,
        [handoverId, config.tenantId],
        client
      );
      if (existing?.status === 'ACCEPTED' && String(existing.incoming_operator_id) === String(parseOperatorUuid(incomingUserId))) {
        return mapHandover(existing); // idempotent
      }
      throw httpError('Handover not found or not PENDING', 404);
    }

    const machineCode = updated.machine_code;
    const processCode = updated.process_code;

    const activeSessions = await query(
      `SELECT * FROM txn.machine_shift_session
       WHERE tenant_id = $1 AND machine_code = $2 AND status = 'ACTIVE'`,
      [config.tenantId, machineCode],
      client
    );
    let outgoingShiftLogId = null;
    for (const s of activeSessions) {
      outgoingShiftLogId = outgoingShiftLogId || s.shift_log_id;
      await query(
        `UPDATE txn.machine_shift_session
         SET status = 'CLOSED', closed_at = now(), updated_at = now()
         WHERE id = $1 AND tenant_id = $2`,
        [s.id, config.tenantId],
        client
      );
      await closeShiftLog(s.shift_log_id, client);
    }

    // Also use closed session from outgoing if no active left
    if (!outgoingShiftLogId) {
      const last = await queryOne(
        `SELECT shift_log_id FROM txn.machine_shift_session
         WHERE tenant_id = $1 AND machine_code = $2
         ORDER BY closed_at DESC NULLS LAST, started_at DESC LIMIT 1`,
        [config.tenantId, machineCode],
        client
      );
      outgoingShiftLogId = last?.shift_log_id ?? null;
    }

    const incomingShiftCode = updated.incoming_shift_code || resolveShiftFromClock().shiftCode;
    const incomingProdDate = updated.incoming_prod_date
      ? String(updated.incoming_prod_date).slice(0, 10)
      : plantDateString();

    const shiftLog = await findOrOpenShiftLog(
      machineCode,
      incomingShiftCode,
      incomingProdDate,
      client
    );

    await query(
      `INSERT INTO txn.machine_shift_session (
         tenant_id, machine_code, shift_code, prod_date,
         operator_user_id, shift_log_id, status
       ) VALUES ($1,$2,$3,$4::date,$5,$6,'ACTIVE')`,
      [
        config.tenantId,
        machineCode,
        incomingShiftCode,
        incomingProdDate,
        String(incomingUserId),
        shiftLog.id,
      ],
      client
    );

    await reparentOpenWork(client, {
      machineCode,
      processCode,
      outgoingShiftLogId,
      incomingShiftLogId: shiftLog.id,
    });

    return mapHandover(updated);
  });
}

export async function requestClarification(handoverId, incomingUserId, notes) {
  const clarification = String(notes ?? '').trim();
  if (!clarification) throw httpError('Clarification notes required', 400);

  return withTransaction(async (client) => {
    const updated = await queryOne(
      `UPDATE txn.machine_handover
       SET status = 'CLARIFICATION_REQUESTED',
           incoming_operator_id = $3::uuid,
           clarification_notes = $4,
           updated_at = now()
       WHERE handover_id = $1 AND tenant_id = $2 AND status = 'PENDING'
       RETURNING *`,
      [handoverId, config.tenantId, await resolveOperatorFk(incomingUserId, client), clarification],
      client
    );

    if (!updated) {
      const existing = await queryOne(
        `SELECT * FROM txn.machine_handover WHERE handover_id = $1 AND tenant_id = $2`,
        [handoverId, config.tenantId],
        client
      );
      if (existing?.status === 'CLARIFICATION_REQUESTED') return mapHandover(existing);
      throw httpError('Handover not found or not PENDING', 404);
    }
    return mapHandover(updated);
  });
}

/**
 * Create AUTO_COMPLETED boundary handover + close session + reparent.
 * Used by ShiftBoundaryService.
 */
export async function createAutoBoundaryHandover(session, client) {
  const machineCode = session.machine_code;
  const machine = await getMachine(machineCode, client);
  const processCode = machine?.process_code || machineCode;
  const clock = resolveShiftFromClock();
  const remarks =
    'System-generated at shift boundary — operator did not submit handover before shift end.';

  const incomingShiftCode = clock.nextShiftCode;
  const incomingProdDate = clock.nextProdDate;
  const outgoingShift = session.shift_code || clock.shiftCode;
  const outgoingDate = asDateOnly(session.prod_date ?? clock.prodDate);

  const openStoppages = await loadOpenStoppages(machineCode, processCode);
  const prod = await loadProductionSummary(machineCode, processCode, session.shift_log_id);

  let handover;
  try {
    handover = await queryOne(
      `INSERT INTO txn.machine_handover (
         tenant_id, machine_code, process_code,
         outgoing_shift_code, incoming_shift_code,
         outgoing_prod_date, incoming_prod_date,
         outgoing_operator_id, machine_status, remarks, handover_priority,
         production_snapshot, open_stoppages, queue_snapshot,
         status, created_by_boundary, accepted_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6::date,$7::date,$8::uuid,'IDLE',$9,'MEDIUM',
         $10::jsonb,$11::jsonb,'{}'::jsonb,
         'AUTO_COMPLETED', true, now()
       ) RETURNING *`,
      [
        config.tenantId,
        machineCode,
        processCode,
        outgoingShift,
        incomingShiftCode,
        outgoingDate,
        incomingProdDate,
        await resolveOperatorFk(session.operator_user_id, client),
        remarks,
        JSON.stringify({
          machineCondition: 'NORMAL',
          openWork: prod.openWork,
          shiftProductionSummary: { openWorkCount: prod.openWorkCount },
          autoBoundary: true,
        }),
        JSON.stringify(openStoppages),
      ],
      client
    );
  } catch (e) {
    if (e?.code === '23505') {
      const err = httpError('PENDING_RACE', 409, 'PENDING_RACE');
      throw err;
    }
    throw e;
  }

  const outgoingShiftLogId = session.shift_log_id;
  await query(
    `UPDATE txn.machine_shift_session
     SET status = 'CLOSED', closed_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
    [session.id, config.tenantId],
    client
  );
  await closeShiftLog(outgoingShiftLogId, client);

  const incomingLog = await findOrOpenShiftLog(
    machineCode,
    incomingShiftCode,
    incomingProdDate,
    client
  );

  await reparentOpenWork(client, {
    machineCode,
    processCode,
    outgoingShiftLogId,
    incomingShiftLogId: incomingLog.id,
  });

  return mapHandover(handover);
}

export { HANDOVER_MIN_REMARKS };
