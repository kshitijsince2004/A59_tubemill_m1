import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  userHasMachineAccess,
  userHasProcessAccess,
} from '../middleware/authMiddleware';
import {
  listBySession,
  listByShiftLog,
  attachRosterToSession,
  create as createSessionCrew,
} from '../services/CrewService';
import { ensureActiveSession, getActiveSession } from '../services/MachineSessionService';
import { inferProcessCode } from '../auth/handoverAccessPolicy';
import { queryOne } from '../db/pool';
import { config } from '../config';

const router = Router();

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message, extra = {}) {
  res.status(status).json({
    data: extra.data ?? null,
    errors: [{ message, ...(extra.code ? { code: extra.code } : {}) }],
  });
}

async function resolveMachineProcess(machineCode) {
  const row = await queryOne(
    `SELECT process_code FROM master.machine
     WHERE machine_code = $1 AND tenant_id = $2`,
    [machineCode, config.tenantId]
  );
  return row?.process_code || inferProcessCode(machineCode);
}

/** Session ensure: machine READ/WRITE, or process WRITE for that machine's process. */
async function assertMachineSessionAccess(user, machineCode) {
  if (
    user.roles?.includes('ADMIN') ||
    user.roles?.includes('PLANT_HEAD') ||
    user.roles?.includes('MACHINE_HEAD')
  ) {
    return;
  }
  if (
    userHasMachineAccess(user, machineCode, 'WRITE') ||
    userHasMachineAccess(user, machineCode, 'READ')
  ) {
    return;
  }
  const processCode = await resolveMachineProcess(machineCode);
  if (processCode && userHasProcessAccess(user, processCode, 'WRITE')) {
    return;
  }
  const err = new Error(`Requires access to machine ${machineCode}`);
  err.status = 403;
  throw err;
}

async function assertSessionAccess(user, sessionId, level = 'READ') {
  const session = await queryOne(
    `SELECT * FROM txn.machine_shift_session WHERE id = $1 AND tenant_id = $2`,
    [sessionId, config.tenantId]
  );
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (
    user.roles?.includes('ADMIN') ||
    user.roles?.includes('PLANT_HEAD') ||
    user.roles?.includes('MACHINE_HEAD')
  ) {
    return session;
  }
  if (!userHasMachineAccess(user, session.machine_code, level === 'WRITE' ? 'WRITE' : 'READ')) {
    const processCode = await resolveMachineProcess(session.machine_code);
    const processLevel = level === 'WRITE' ? 'WRITE' : 'READ';
    if (!(processCode && userHasProcessAccess(user, processCode, processLevel))) {
      const err = new Error(`Requires access to machine ${session.machine_code}`);
      err.status = 403;
      throw err;
    }
  }
  return session;
}

async function assertShiftLogAccess(user, shiftLogId, level = 'READ') {
  const shiftLog = await queryOne(
    `SELECT * FROM txn.shift_log WHERE id = $1 AND tenant_id = $2`,
    [shiftLogId, config.tenantId]
  );
  if (!shiftLog) {
    const err = new Error('Shift log not found');
    err.status = 404;
    throw err;
  }
  if (
    user.roles?.includes('ADMIN') ||
    user.roles?.includes('PLANT_HEAD') ||
    user.roles?.includes('MACHINE_HEAD')
  ) {
    return shiftLog;
  }
  if (!userHasMachineAccess(user, shiftLog.machine_code, level === 'WRITE' ? 'WRITE' : 'READ')) {
    const processCode = await resolveMachineProcess(shiftLog.machine_code);
    const processLevel = level === 'WRITE' ? 'WRITE' : 'READ';
    if (!(processCode && userHasProcessAccess(user, processCode, processLevel))) {
      const err = new Error(`Requires access to machine ${shiftLog.machine_code}`);
      err.status = 403;
      throw err;
    }
  }
  return shiftLog;
}

// --- Session ensure ---
router.post(
  '/machines/:machineCode/session',
  authMiddleware,
  requireAuth,
  async (req, res) => {
    try {
      const machineCode = decodeURIComponent(req.params.machineCode);
      await assertMachineSessionAccess(req.user, machineCode);
      const result = await ensureActiveSession(req.user, machineCode, {
        shiftCode: req.body?.shiftCode,
        prodDate: req.body?.prodDate,
      });
      ok(res, result);
    } catch (e) {
      if (e?.status) {
        return fail(res, e.status, e.message, {
          code: e.code,
          data: e.pending ? { pending: e.pending } : null,
        });
      }
      fail(res, 400, e instanceof Error ? e.message : 'Session failed');
    }
  }
);

router.get(
  '/machines/:machineCode/session',
  authMiddleware,
  requireAuth,
  async (req, res) => {
    try {
      const machineCode = decodeURIComponent(req.params.machineCode);
      const session = await getActiveSession(machineCode);
      ok(res, { session });
    } catch (e) {
      fail(res, 400, e instanceof Error ? e.message : 'Lookup failed');
    }
  }
);

// --- Crew routes ---
router.get('/crew', authMiddleware, requireAuth, async (req, res) => {
  try {
    const shiftLogId =
      typeof req.query.shiftLogId === 'string' ? req.query.shiftLogId : undefined;
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    if (sessionId) {
      await assertSessionAccess(req.user, sessionId, 'READ');
      ok(res, { items: await listBySession(sessionId) });
      return;
    }
    if (shiftLogId) {
      await assertShiftLogAccess(req.user, shiftLogId, 'READ');
      ok(res, { items: await listByShiftLog(shiftLogId) });
      return;
    }
    fail(res, 400, 'shiftLogId or sessionId required');
  } catch (e) {
    if (e?.status) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'List failed');
  }
});

router.post('/crew', authMiddleware, requireAuth, async (req, res) => {
  try {
    const shiftLogId = String(req.body?.shiftLogId ?? '');
    await assertShiftLogAccess(req.user, shiftLogId, 'WRITE');
    const row = await createSessionCrew({
      shiftLogId,
      operatorId: req.body?.operatorId ?? req.user.userId,
      roleCode: req.body?.roleCode,
      memberName: req.body?.memberName ?? req.body?.personName ?? req.user.fullName,
      machineCode: req.body?.machineCode,
    });
    ok(res, row);
  } catch (e) {
    if (e?.status) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Create failed');
  }
});

router.post('/crew/attach', authMiddleware, requireAuth, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId ?? '');
    const crewIds = Array.isArray(req.body?.crewIds) ? req.body.crewIds : [];
    await assertSessionAccess(req.user, sessionId, 'WRITE');
    const items = await attachRosterToSession(sessionId, crewIds);
    ok(res, { items });
  } catch (e) {
    if (e?.status) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Attach failed');
  }
});

export default router;
