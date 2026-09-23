import { Router } from 'express';

import {
  authMiddleware,
  requireAuth,
  requireAdmin,
  requireRole } from
'../middleware/authMiddleware';
import {
  listMachines,
  listUsers,
  setMachineAccess,
  setProcessAccess,
  createMachine,
  updateMachine,
  upsertUser } from
'../services/userService';

const router = Router();

function paramId(req, key) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : v;
}

// Scope auth to this router's paths only (do not gate /health, /tubemill, etc.)
router.use('/users', authMiddleware, requireAuth);
router.use('/machines', authMiddleware, requireAuth);

router.get('/users', requireRole('ADMIN', 'PLANT_HEAD'), async (_req, res) => {
  try {
    const users = await listUsers();
    res.json({ data: users, errors: null });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Failed to list users' }]
    });
  }
});

const manageUsers = requireRole('ADMIN', 'PLANT_HEAD');

function assertPlantHeadCannotElevate(req, roles) {
  const isPh = req.appRole === 'PLANT_HEAD' || req.user?.roles?.includes('PLANT_HEAD');
  const isAdmin = req.user?.roles?.includes('ADMIN');
  if (isPh && !isAdmin && (roles ?? []).includes('ADMIN')) {
    const err = new Error('PLANT_HEAD cannot assign ADMIN role');
    err.status = 403;
    throw err;
  }
}

router.post('/users', manageUsers, async (req, res) => {
  try {
    const body = req.body ?? {};
    const roles = body.roles ?? ['OPERATOR'];
    assertPlantHeadCannotElevate(req, roles);
    const user = await upsertUser({
      username: String(body.username ?? ''),
      fullName: String(body.fullName ?? body.full_name ?? ''),
      empCode: body.empCode ?? body.emp_code ?? null,
      email: body.email ?? null,
      status: body.status ?? 'ACTIVE',
      roles,
      pin: body.pin ?? null,
      password: body.password ?? null,
      processAccess: body.processAccess,
      machineAccess: body.machineAccess
    });
    res.status(201).json({ data: user, errors: null });
  } catch (err) {
    res.status(err?.status || 400).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Create failed' }]
    });
  }
});

router.put('/users/:id', manageUsers, async (req, res) => {
  try {
    const body = req.body ?? {};
    const roles = body.roles ?? ['OPERATOR'];
    assertPlantHeadCannotElevate(req, roles);
    const user = await upsertUser({
      userId: paramId(req, 'id'),
      username: String(body.username ?? ''),
      fullName: String(body.fullName ?? body.full_name ?? ''),
      empCode: body.empCode ?? body.emp_code ?? null,
      email: body.email ?? null,
      status: body.status ?? 'ACTIVE',
      roles,
      pin: body.pin ?? null,
      password: body.password ?? null,
      processAccess: body.processAccess,
      machineAccess: body.machineAccess
    });
    res.json({ data: user, errors: null });
  } catch (err) {
    res.status(err?.status || 400).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Update failed' }]
    });
  }
});

router.put('/users/:id/process-access', manageUsers, async (req, res) => {
  try {
    const grants = req.body?.grants ?? [];
    await setProcessAccess(paramId(req, 'id'), grants);
    res.json({ data: { ok: true }, errors: null });
  } catch (err) {
    res.status(400).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Update failed' }]
    });
  }
});

router.put('/users/:id/machine-access', manageUsers, async (req, res) => {
  try {
    const grants = req.body?.grants ?? [];
    await setMachineAccess(paramId(req, 'id'), grants);
    res.json({ data: { ok: true }, errors: null });
  } catch (err) {
    res.status(400).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Update failed' }]
    });
  }
});

router.get('/machines/master', requireRole('ADMIN', 'PLANT_HEAD', 'MACHINE_HEAD'), async (_req, res) => {
  try {
    const machines = await listMachines();
    res.json({ data: machines, errors: null });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Failed to list machines' }]
    });
  }
});

router.post('/machines/master', requireAdmin, async (req, res) => {
  try {
    const machine = await createMachine({
      machineCode: req.body?.machineCode ?? req.body?.machine_code,
      label: req.body?.label,
      processCode: req.body?.processCode ?? req.body?.process_code
    });
    res.status(201).json({ data: machine, errors: null });
  } catch (err) {
    res.status(err?.status || 400).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Create failed' }]
    });
  }
});

router.patch('/machines/master/:code', requireAdmin, async (req, res) => {
  try {
    await updateMachine(paramId(req, 'code'), {
      label: req.body?.label,
      processCode: req.body?.processCode ?? req.body?.process_code
    });
    res.json({ data: { ok: true }, errors: null });
  } catch (err) {
    res.status(400).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Update failed' }]
    });
  }
});

export default router;