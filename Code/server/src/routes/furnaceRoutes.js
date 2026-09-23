import { Router } from 'express';
import { furCreateSchema, furUpdateSchema, furGasLogSchema } from '@a59/shared';
import {
  listAnnRuns,
  getAnnRun,
  createAnnRun,
  updateAnnRun,
  setAnnStatus,
  addGasLog,
  listFurnaceMachines,
  getFurnaceRecipe,
  resolveFurnaceMaster,
  getFurnaceBoard,
  assignFurnaceOrder,
  listOpenFurnaceStoppages,
  listFurnaceStoppageHistory,
  listFurnaceGasLogs,
  getFurnaceDailyConsumption,
  upsertFurnaceDailyConsumption,
  startFurnaceProduction,
  endFurnaceProduction,
  assertFurnaceApprovable,
  clearFurnaceExcursion } from
'../services/FurnaceService';
import { buildFurnaceExport, buildFurnaceCsv } from '../services/FurnaceExportService';
import { listReports, renderReport } from '../export/ReportExportService';
import { claimHttpIdempotency } from '../services/RunService';
import { assertValid, ValidationError } from '../services/ValidationGate';
import { assertMachineApproval } from '../auth/machineAccessPolicy';
import {
  authMiddleware,
  requireAuth,
  requireProcessAccess,
  requireMachineHead,
  requireWritable } from

'../middleware/authMiddleware';

const router = Router();
router.use('/furnace', authMiddleware, requireAuth);
router.use('/furnace', (req, res, next) => {
  const level = req.method === 'GET' || req.method === 'HEAD' ? 'READ' : 'WRITE';
  requireProcessAccess('FUR', level)(req, res, next);
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

router.get('/furnace/machines', async (_req, res) => {
  ok(res, await listFurnaceMachines());
});

router.get('/furnace/board', async (_req, res) => {
  try {
    ok(res, await getFurnaceBoard());
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Board failed');
  }
});

router.post('/furnace/board/:furnaceCode/assign', requireWritable, withIdempotency, async (req, res) => {
  try {
    const furnaceCode = Array.isArray(req.params.furnaceCode)
      ? req.params.furnaceCode[0]
      : req.params.furnaceCode;
    const lot = await assignFurnaceOrder(furnaceCode, req.body ?? {});
    ok(res, lot);
  } catch (e) {
    failCaught(res, e, 'Assign failed');
  }
});

router.get('/furnace/stoppages/open', async (_req, res) => {
  try {
    ok(res, await listOpenFurnaceStoppages());
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Open stoppages failed');
  }
});

router.get('/furnace/stoppages', async (req, res) => {
  try {
    const openRaw = typeof req.query.openOnly === 'string' ? req.query.openOnly : undefined;
    let openOnly;
    if (openRaw === 'true' || openRaw === '1') openOnly = true;
    else if (openRaw === 'false' || openRaw === '0') openOnly = false;
    ok(
      res,
      await listFurnaceStoppageHistory({
        furnaceCode: typeof req.query.furnaceCode === 'string' ? req.query.furnaceCode : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
        openOnly,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Stoppage history failed');
  }
});

router.get('/furnace/gas-logs', async (req, res) => {
  try {
    ok(
      res,
      await listFurnaceGasLogs({
        furnaceCode: typeof req.query.furnaceCode === 'string' ? req.query.furnaceCode : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Gas logs failed');
  }
});

router.get('/furnace/consumption', async (req, res) => {
  try {
    const furnaceCode = typeof req.query.furnaceCode === 'string' ? req.query.furnaceCode : '';
    const prodDate = typeof req.query.prodDate === 'string' ? req.query.prodDate : '';
    if (!furnaceCode || !prodDate) return fail(res, 400, 'furnaceCode and prodDate required');
    ok(res, await getFurnaceDailyConsumption(furnaceCode, prodDate));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Consumption load failed');
  }
});

router.put('/furnace/consumption', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await upsertFurnaceDailyConsumption(req.body ?? {}));
  } catch (e) {
    failCaught(res, e, 'Consumption save failed');
  }
});

router.get('/furnace/recipes', async (req, res) => {
  try {
    const recipe = await getFurnaceRecipe({
      gradeCode: typeof req.query.gradeCode === 'string' ? req.query.gradeCode : undefined,
      furnaceCode: typeof req.query.furnaceCode === 'string' ? req.query.furnaceCode : undefined,
    });
    ok(res, recipe);
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Recipe lookup failed');
  }
});

router.get('/furnace/lots', async (req, res) => {
  try {
    const lots = await listAnnRuns({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      furnaceCode: typeof req.query.furnaceCode === 'string' ? req.query.furnaceCode : undefined,
      workOrderNo: typeof req.query.workOrderNo === 'string' ? req.query.workOrderNo : undefined,
      fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
      toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined
    });
    ok(res, lots);
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'List failed');
  }
});

router.get('/furnace/lots/:id', async (req, res) => {
  const lot = await getAnnRun(paramId(req));
  if (!lot) return fail(res, 404, 'Not found');
  ok(res, lot);
});

router.post('/furnace/lots', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = furCreateSchema.parse(req.body);
    const master = await resolveFurnaceMaster(parsed);
    const warnings = await assertValid('FUR', parsed, { master });
    const lot = await createAnnRun({
      ...parsed,
      createdBy:
        req.user?.fullName ??
        req.user?.empCode ??
        req.user?.username ??
        req.user?.userId ??
        parsed.createdBy ??
        null,
      dataSource: 'MANUAL',
    });
    ok(res, { ...lot, warnings });
  } catch (e) {
    failCaught(res, e, 'Create failed');
  }
});

router.put('/furnace/lots/:id', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = furUpdateSchema.partial().parse({ ...req.body, id: paramId(req) });
    const existing = await getAnnRun(paramId(req));
    const merged = { ...(existing ?? {}), ...parsed };
    const master = await resolveFurnaceMaster(merged);
    const warnings = await assertValid('FUR', merged, { master });
    const lot = await updateAnnRun(paramId(req), parsed);
    ok(res, { ...lot, warnings });
  } catch (e) {
    failCaught(res, e, 'Update failed');
  }
});

router.post('/furnace/lots/:id/submit', requireWritable, withIdempotency, async (req, res) => {
  try {
    const existing = await getAnnRun(paramId(req));
    if (!existing) return fail(res, 404, 'Not found');
    if (!existing.disposition) {
      return fail(res, 422, 'Disposition is required to submit', [
        { field: 'disposition', message: 'Disposition is required', severity: 'ERROR' },
      ]);
    }
    const master = await resolveFurnaceMaster(existing);
    await assertValid('FUR', existing, { master });
    ok(res, await setAnnStatus(paramId(req), 'SUBMITTED'));
  } catch (e) {
    failCaught(res, e, 'Submit failed');
  }
});

router.post('/furnace/lots/:id/start', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await startFurnaceProduction(paramId(req)));
  } catch (e) {
    failCaught(res, e, 'Start failed');
  }
});

router.post('/furnace/lots/:id/end', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await endFurnaceProduction(paramId(req)));
  } catch (e) {
    failCaught(res, e, 'End failed');
  }
});

router.post('/furnace/lots/:id/approve', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const existing = await getAnnRun(paramId(req));
    if (!existing) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, existing.furnaceCode);
    if (!existing.disposition) {
      return fail(res, 422, 'Disposition is required to approve', [
        { field: 'disposition', message: 'Disposition is required', severity: 'ERROR' },
      ]);
    }
    await assertFurnaceApprovable(existing);
    const master = await resolveFurnaceMaster(existing);
    await assertValid('FUR', existing, { master });
    ok(res, await setAnnStatus(paramId(req), 'APPROVED'));
  } catch (e) {
    if (e?.status === 403 || e?.status === 401 || e?.status === 422) {
      return fail(res, e.status, e.message, e.issues);
    }
    failCaught(res, e, 'Approve failed');
  }
});

router.post('/furnace/lots/:id/clear-excursion', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const existing = await getAnnRun(paramId(req));
    if (!existing) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, existing.furnaceCode);
    ok(
      res,
      await clearFurnaceExcursion(paramId(req), {
        disposition: req.body?.disposition ?? 'ACCEPT_WITH_NOTE',
        note: req.body?.note ?? req.body?.remark,
        clearedBy: req.user?.username ?? req.user?.empCode ?? 'MACHINE_HEAD',
      })
    );
  } catch (e) {
    if (e?.status === 403 || e?.status === 401) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Clear excursion failed');
  }
});

router.post('/furnace/lots/:id/hold', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const existing = await getAnnRun(paramId(req));
    if (!existing) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, existing.furnaceCode);
    ok(res, await setAnnStatus(paramId(req), 'HOLD'));
  } catch (e) {
    if (e?.status === 403 || e?.status === 401) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Hold failed');
  }
});

router.post('/furnace/lots/:id/gas-log', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = furGasLogSchema.parse({ ...req.body, runId: paramId(req) });
    ok(res, await addGasLog(parsed));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Gas log failed');
  }
});

router.get('/furnace/lots/:id/export', requireMachineHead, async (req, res) => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format : 'json';
    if (format === 'csv') {
      const csv = await buildFurnaceCsv(paramId(req));
      res.setHeader('Content-Type', 'text/csv');
      res.send(csv);
      return;
    }
    ok(res, await buildFurnaceExport(paramId(req)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Export failed');
  }
});

router.get('/furnace/reports', requireMachineHead, (_req, res) => {
  ok(res, listReports('FUR'));
});

router.post('/furnace/export', requireMachineHead, async (req, res) => {
  try {
    const report = String(req.body?.report ?? 'ANN-FT-01');
    const { report: _ignored, filters: nested, ...rest } = req.body ?? {};
    const filters = { ...(nested ?? {}), ...rest };
    const operatorName =
      req.user?.fullName ?? req.user?.empCode ?? req.user?.username ?? filters.createdBy ?? '';
    if (!filters.supervisor && operatorName) filters.supervisor = operatorName;
    if (!filters.incharge && operatorName) filters.incharge = operatorName;
    const { buffer, filename } = await renderReport(report, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'XLSX export failed');
  }
});

router.get('/furnace/session', (req, res) => {
  ok(res, { role: req.appRole, process: 'FUR' });
});

export default router;