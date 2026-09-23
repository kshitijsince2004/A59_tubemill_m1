import { Router } from 'express';
import { drwSwageSchema } from '@a59/shared';
import {
  listSwageLots,
  getSwageLot,
  createSwageLot,
  updateSwageLot,
  setSwageStatus,
  listSwageMachines } from
'../services/SwageService';
import { assertValid, ValidationError } from '../services/ValidationGate';
import { claimHttpIdempotency } from '../services/RunService';
import { assertMachineApproval } from '../auth/machineAccessPolicy';
import {
  authMiddleware,
  requireAuth,
  requireProcessAccess,
  requireMachineHead,
  requireWritable } from
'../middleware/authMiddleware';

const router = Router();
router.use('/swage', authMiddleware, requireAuth);
router.use('/swage', (req, res, next) => {
  const level = req.method === 'GET' || req.method === 'HEAD' ? 'READ' : 'WRITE';
  requireProcessAccess('SWG', level)(req, res, next);
});

function paramId(req) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}
function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message, issues) {
  res.status(status).json({ data: null, errors: issues ?? [{ message }] });
}
function failCaught(res, e, fallback) {
  if (e instanceof ValidationError) return fail(res, 422, e.message, e.issues);
  fail(res, 400, e instanceof Error ? e.message : fallback);
}

async function withIdempotency(req, res, next) {
  const key = req.header('Idempotency-Key');
  if (!key) return next();
  const claimed = await claimHttpIdempotency(`http:${req.method}:${req.path}`, key);
  if (!claimed) return fail(res, 409, 'Duplicate Idempotency-Key');
  return next();
}

router.get('/swage/machines', async (_req, res) => {
  ok(res, await listSwageMachines());
});

router.get('/swage/lots', async (req, res) => {
  try {
    ok(
      res,
      await listSwageLots({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        workOrderNo: typeof req.query.workOrderNo === 'string' ? req.query.workOrderNo : undefined
      })
    );
  } catch (e) {
    failCaught(res, e, 'List failed');
  }
});

router.get('/swage/lots/:id', async (req, res) => {
  const lot = await getSwageLot(paramId(req));
  if (!lot) return fail(res, 404, 'Not found');
  ok(res, lot);
});

router.post('/swage/lots', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = drwSwageSchema.parse(req.body);
    const warnings = await assertValid('SWG', parsed);
    ok(res, { ...(await createSwageLot(parsed)), warnings });
  } catch (e) {
    failCaught(res, e, 'Create failed');
  }
});

router.put('/swage/lots/:id', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = drwSwageSchema.partial().parse(req.body);
    const warnings = await assertValid('SWG', parsed);
    ok(res, { ...(await updateSwageLot(paramId(req), parsed)), warnings });
  } catch (e) {
    failCaught(res, e, 'Update failed');
  }
});

router.post('/swage/lots/:id/submit', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await setSwageStatus(paramId(req), 'SUBMITTED'));
  } catch (e) {
    failCaught(res, e, 'Submit failed');
  }
});

router.post('/swage/lots/:id/approve', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const lot = await getSwageLot(paramId(req));
    if (!lot) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, lot.swgMachine);
    ok(res, await setSwageStatus(paramId(req), 'APPROVED'));
  } catch (e) {
    if (e?.status === 403 || e?.status === 401) return fail(res, e.status, e.message);
    failCaught(res, e, 'Approve failed');
  }
});

export default router;