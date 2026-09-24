import { Router } from 'express';
import { authMiddleware, requireAuth } from '../middleware/authMiddleware';
import {
  assertHandoverMachineAccess,
  handoverOverviewMachineFilter,
} from '../auth/handoverAccessPolicy';
import {
  listPendingForMachines,
  getPendingForMachine,
  getDraftForMachine,
  buildOutgoingPreview,
  saveDraftHandover,
  createOutgoingHandover,
  acceptHandover,
  requestClarification,
  getHandoverOverview,
  getHandoverForAccess,
} from '../services/MachineHandoverService';
import { ensureActiveSession } from '../services/MachineSessionService';
import { accessibleMachineCodes } from '../auth/machineAccessPolicy';

const router = Router();

/** Simple in-memory rate limit: 60 req / 60s per user */
const hits = new Map();
function rateLimit(req, res, next) {
  const key = String(req.user?.userId ?? req.ip ?? 'anon');
  const now = Date.now();
  let bucket = hits.get(key);
  if (!bucket || now - bucket.start > 60_000) {
    bucket = { start: now, count: 0 };
    hits.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > 60) {
    return res.status(429).json({ data: null, errors: [{ message: 'Rate limit exceeded' }] });
  }
  next();
}

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message, code) {
  res.status(status).json({
    data: null,
    errors: [{ message, ...(code ? { code } : {}) }],
  });
}

function statusOf(e) {
  return e?.status || 400;
}

router.use(authMiddleware, requireAuth, rateLimit);

router.get('/overview', async (req, res) => {
  try {
    const filter = handoverOverviewMachineFilter(req.user);
    ok(res, await getHandoverOverview(filter));
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Overview failed');
  }
});

router.get('/pending', async (req, res) => {
  try {
    const codes = accessibleMachineCodes(req.user);
    const list = codes == null
      ? (await getHandoverOverview(null)).pending
      : await listPendingForMachines(codes);
    ok(res, { pending: list });
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Pending list failed');
  }
});

router.get('/:machineCode/preview', async (req, res) => {
  try {
    const machineCode = decodeURIComponent(req.params.machineCode);
    await assertHandoverMachineAccess(req.user, machineCode);
    ok(res, await buildOutgoingPreview(machineCode, req.user.userId));
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Preview failed');
  }
});

router.get('/:machineCode/pending', async (req, res) => {
  try {
    const machineCode = decodeURIComponent(req.params.machineCode);
    await assertHandoverMachineAccess(req.user, machineCode);
    ok(res, { pending: await getPendingForMachine(machineCode) });
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Pending failed');
  }
});

router.get('/:machineCode/draft', async (req, res) => {
  try {
    const machineCode = decodeURIComponent(req.params.machineCode);
    await assertHandoverMachineAccess(req.user, machineCode);
    ok(res, { draft: await getDraftForMachine(machineCode, req.user.userId) });
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Draft failed');
  }
});

router.post('/:machineCode/session', async (req, res) => {
  try {
    const machineCode = decodeURIComponent(req.params.machineCode);
    await assertHandoverMachineAccess(req.user, machineCode);
    const result = await ensureActiveSession(req.user, machineCode, {
      shiftCode: req.body?.shiftCode,
      prodDate: req.body?.prodDate,
    });
    ok(res, result);
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Session failed', e?.code);
  }
});

router.post('/:machineCode/draft', async (req, res) => {
  try {
    const machineCode = decodeURIComponent(req.params.machineCode);
    await assertHandoverMachineAccess(req.user, machineCode);
    ok(res, await saveDraftHandover(machineCode, req.user.userId, req.body ?? {}));
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Draft save failed');
  }
});

router.post('/:machineCode/outgoing', async (req, res) => {
  try {
    const machineCode = decodeURIComponent(req.params.machineCode);
    await assertHandoverMachineAccess(req.user, machineCode);
    ok(res, await createOutgoingHandover(machineCode, req.user.userId, req.body ?? {}));
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Outgoing failed', e?.code);
  }
});

router.post('/accept/:handoverId', async (req, res) => {
  try {
    const handoverId = req.params.handoverId;
    const meta = await getHandoverForAccess(handoverId);
    if (!meta) return fail(res, 404, 'Handover not found');
    await assertHandoverMachineAccess(req.user, meta.machine_code);
    ok(res, await acceptHandover(handoverId, req.user.userId));
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Accept failed');
  }
});

router.post('/clarification/:handoverId', async (req, res) => {
  try {
    const handoverId = req.params.handoverId;
    const meta = await getHandoverForAccess(handoverId);
    if (!meta) return fail(res, 404, 'Handover not found');
    await assertHandoverMachineAccess(req.user, meta.machine_code);
    ok(res, await requestClarification(handoverId, req.user.userId, req.body?.notes ?? req.body?.clarificationNotes));
  } catch (e) {
    fail(res, statusOf(e), e instanceof Error ? e.message : 'Clarification failed');
  }
});

export default router;
