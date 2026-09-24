import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requireMachineHead,
  requireRole,
} from '../middleware/authMiddleware';
import { assertHandoverMachineAccess } from '../auth/handoverAccessPolicy';
import {
  listCrew,
  addCrew,
  updateCrew,
  removeCrew,
  RosterTableMissingError,
} from '../services/MachineCrewService';

const router = Router();
router.use('/machine-head', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

function handleCrewError(res, e, fallback) {
  if (e instanceof RosterTableMissingError || e?.status === 503) {
    return fail(res, 503, e.message);
  }
  if (e?.status) return fail(res, e.status, e.message);
  fail(res, 400, e instanceof Error ? e.message : fallback);
}

/** OPERATOR + MH + PH + ADMIN may read (operators scoped to own machine). */
router.get(
  '/machine-head/crew',
  requireRole('OPERATOR', 'MACHINE_HEAD', 'PLANT_HEAD', 'ADMIN'),
  async (req, res) => {
    try {
      const machineCode =
        typeof req.query.machine === 'string'
          ? req.query.machine
          : typeof req.query.machineCode === 'string'
            ? req.query.machineCode
            : undefined;
      ok(res, { items: await listCrew(req.user, machineCode) });
    } catch (e) {
      handleCrewError(res, e, 'List failed');
    }
  }
);

router.post('/machine-head/crew', requireMachineHead, async (req, res) => {
  try {
    const machineCode = String(req.body?.machineCode ?? '');
    // Align with handover: process WRITE or machine WRITE (not machine-only approval).
    await assertHandoverMachineAccess(req.user, machineCode);
    ok(
      res,
      await addCrew({
        machineCode,
        roleLabel: String(req.body?.roleLabel ?? 'Operator'),
        personName: String(req.body?.personName ?? req.body?.memberName ?? ''),
        shiftCode: String(req.body?.shiftCode ?? 'A'),
      })
    );
  } catch (e) {
    handleCrewError(res, e, 'Add failed');
  }
});

router.put('/machine-head/crew/:id', requireMachineHead, async (req, res) => {
  try {
    const row = await updateCrew(req.user, req.params.id, {
      personName: req.body?.personName ?? req.body?.memberName,
      roleLabel: req.body?.roleLabel,
      shiftCode: req.body?.shiftCode,
    });
    if (!row) return fail(res, 404, 'Not found');
    ok(res, row);
  } catch (e) {
    handleCrewError(res, e, 'Update failed');
  }
});

router.delete('/machine-head/crew/:id', requireMachineHead, async (req, res) => {
  try {
    const machineCode =
      typeof req.query.machineCode === 'string'
        ? req.query.machineCode
        : typeof req.query.machine === 'string'
          ? req.query.machine
          : undefined;
    const row = await removeCrew(req.user, req.params.id, machineCode);
    if (!row) return fail(res, 404, 'Not found');
    ok(res, row);
  } catch (e) {
    handleCrewError(res, e, 'Delete failed');
  }
});

export default router;
