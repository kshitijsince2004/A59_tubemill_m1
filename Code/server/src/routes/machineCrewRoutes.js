import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requireMachineHead,
} from '../middleware/authMiddleware';
import { assertMachineApproval } from '../auth/machineAccessPolicy';
import {
  listCrew,
  addCrew,
  removeCrew,
} from '../services/MachineCrewService';

const router = Router();
router.use('/machine-head', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/machine-head/crew', requireMachineHead, async (req, res) => {
  try {
    const machineCode = typeof req.query.machine === 'string' ? req.query.machine : undefined;
    ok(res, { items: await listCrew(req.user, machineCode) });
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'List failed');
  }
});

router.post('/machine-head/crew', requireMachineHead, async (req, res) => {
  try {
    const machineCode = String(req.body?.machineCode ?? '');
    assertMachineApproval(req.user, machineCode);
    ok(
      res,
      await addCrew({
        machineCode,
        roleLabel: String(req.body?.roleLabel ?? 'Operator'),
        personName: String(req.body?.personName ?? ''),
        shiftCode: String(req.body?.shiftCode ?? 'A'),
      })
    );
  } catch (e) {
    if (e?.status) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Add failed');
  }
});

router.delete('/machine-head/crew/:id', requireMachineHead, async (req, res) => {
  try {
    const row = await removeCrew(req.user, req.params.id);
    if (!row) return fail(res, 404, 'Not found');
    ok(res, row);
  } catch (e) {
    if (e?.status) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Delete failed');
  }
});

export default router;
