import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requireMachineHead,
  requireRole,
} from '../middleware/authMiddleware';
import {
  listQualitySpecs,
  getQualitySpec,
  createQualitySpec,
  updateQualitySpec,
} from '../services/QualitySpecService';

const router = Router();
router.use('/quality', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

const qualityWrite = requireRole('MACHINE_HEAD', 'ADMIN');

router.get('/quality/specs', requireMachineHead, async (req, res) => {
  try {
    const processCode = typeof req.query.process === 'string' ? req.query.process : undefined;
    ok(res, { items: await listQualitySpecs({ processCode }) });
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'List failed');
  }
});

router.get('/quality/specs/:id', requireMachineHead, async (req, res) => {
  try {
    const row = await getQualitySpec(req.params.id);
    if (!row) return fail(res, 404, 'Not found');
    ok(res, row);
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Get failed');
  }
});

router.post('/quality/specs', qualityWrite, async (req, res) => {
  try {
    ok(res, await createQualitySpec(req.body ?? {}, req.user?.username ?? req.user?.empCode));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Create failed');
  }
});

router.put('/quality/specs/:id', qualityWrite, async (req, res) => {
  try {
    const row = await updateQualitySpec(req.params.id, req.body ?? {});
    if (!row) return fail(res, 404, 'Not found');
    ok(res, row);
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Update failed');
  }
});

export default router;
