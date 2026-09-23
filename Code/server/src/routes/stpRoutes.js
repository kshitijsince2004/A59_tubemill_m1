import { Router } from 'express';
import {
  stpCreateSchema,
  stpUpdateSchema,
  stpBathAnalysisSchema,
  stpCoatingSchema,
  stpBathHistorySchema,
  stpChemicalAdditionSchema } from
'@a59/shared';
import {
  listStpLots,
  getStpLot,
  createStpLot,
  updateStpLot,
  setStpStatus,
  addBathAnalysis,
  addCoating,
  addBathHistory,
  listBathHistory,
  listBathSpecs,
  validateBathAgainstSpec,
  listStpOrders,
  assignStpOrder,
  startStpProduction,
  endStpProduction,
  holdStpLot,
  assertStpBathSigned,
  signOffBath,
  addChemicalAddition,
  listChemicalAdditions,
  listBathAnalysisHistory,
  listStpStoppageHistory,
  listStpStages,
  ensureStpStages,
  advanceStpStage,
  getStpLiveStatus } from
'../services/StpService';
import { buildStpExport, buildStpCsv } from '../services/StpExportService';
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
router.use('/stp', authMiddleware, requireAuth);
router.use('/stp', (req, res, next) => {
  const level = req.method === 'GET' || req.method === 'HEAD' ? 'READ' : 'WRITE';
  requireProcessAccess('STP', level)(req, res, next);
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

router.get('/stp/orders', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'Released';
    ok(res, await listStpOrders(status));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Orders failed');
  }
});

router.get('/stp/live-status', async (_req, res) => {
  try {
    ok(res, await getStpLiveStatus());
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Live status failed');
  }
});

router.get('/stp/lots', async (req, res) => {
  try {
    ok(
      res,
      await listStpLots({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        workOrderNo: typeof req.query.workOrderNo === 'string' ? req.query.workOrderNo : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'List failed');
  }
});

router.get('/stp/bath-history', async (_req, res) => {
  ok(res, await listBathHistory());
});

router.get('/stp/bath-specs', async (_req, res) => {
  try {
    ok(res, await listBathSpecs());
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Bath specs failed');
  }
});

router.get('/stp/history/bath-analysis', async (req, res) => {
  try {
    ok(
      res,
      await listBathAnalysisHistory({
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
        workOrderNo: typeof req.query.workOrderNo === 'string' ? req.query.workOrderNo : undefined,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Bath analysis history failed');
  }
});

router.get('/stp/history/chemical', async (req, res) => {
  try {
    ok(
      res,
      await listChemicalAdditions({
        lotId: typeof req.query.lotId === 'string' ? req.query.lotId : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Chemical history failed');
  }
});

router.get('/stp/history/stoppages', async (req, res) => {
  try {
    ok(
      res,
      await listStpStoppageHistory({
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Stoppage history failed');
  }
});

router.get('/stp/lots/:id', async (req, res) => {
  const lot = await getStpLot(paramId(req));
  if (!lot) return fail(res, 404, 'Not found');
  ok(res, lot);
});

router.post('/stp/lots/assign', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await assignStpOrder(req.body ?? {}));
  } catch (e) {
    failCaught(res, e, 'Assign failed');
  }
});

router.post('/stp/lots', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = stpCreateSchema.parse(req.body);
    const warnings = await assertValid('STP', parsed);
    ok(res, { ...(await createStpLot(parsed)), warnings });
  } catch (e) {
    failCaught(res, e, 'Create failed');
  }
});

router.put('/stp/lots/:id', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = stpUpdateSchema.partial().parse({ ...req.body, id: paramId(req) });
    const warnings = await assertValid('STP', parsed);
    ok(res, { ...(await updateStpLot(paramId(req), parsed)), warnings });
  } catch (e) {
    failCaught(res, e, 'Update failed');
  }
});

router.post('/stp/lots/:id/start', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await startStpProduction(paramId(req)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Start failed');
  }
});

router.post('/stp/lots/:id/end', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await endStpProduction(paramId(req)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'End failed');
  }
});

router.get('/stp/lots/:id/stages', async (req, res) => {
  try {
    ok(res, await listStpStages(paramId(req)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Stages failed');
  }
});

router.post('/stp/lots/:id/stages/ensure', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await ensureStpStages(paramId(req), { activateFirst: true }));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Ensure stages failed');
  }
});

router.post('/stp/lots/:id/stages/advance', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await advanceStpStage(paramId(req)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Advance failed');
  }
});

router.post('/stp/lots/:id/submit', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await setStpStatus(paramId(req), 'SUBMITTED'));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Submit failed');
  }
});

router.post('/stp/lots/:id/approve', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const lot = await getStpLot(paramId(req));
    if (!lot) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, lot.machineCode);
    await assertStpBathSigned(paramId(req), lot);
    ok(res, await setStpStatus(paramId(req), 'APPROVED'));
  } catch (e) {
    if (e?.status === 403 || e?.status === 401 || e?.status === 422) {
      return fail(res, e.status, e.message, e.issues);
    }
    fail(res, 400, e instanceof Error ? e.message : 'Approve failed');
  }
});

router.post('/stp/lots/:id/bath-sign-off', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const lot = await getStpLot(paramId(req));
    if (!lot) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, lot.machineCode);
    ok(
      res,
      await signOffBath(paramId(req), {
        signedBy: req.user?.username ?? req.user?.empCode ?? 'MACHINE_HEAD',
        note: req.body?.note ?? req.body?.remark,
      })
    );
  } catch (e) {
    if (e?.status === 403 || e?.status === 401) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Bath sign-off failed');
  }
});

router.post('/stp/lots/:id/hold', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const lot = await getStpLot(paramId(req));
    if (!lot) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, lot.machineCode);
    ok(res, await holdStpLot(paramId(req)));
  } catch (e) {
    if (e?.status === 403 || e?.status === 401) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Hold failed');
  }
});

router.post('/stp/lots/:id/bath-analysis', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = stpBathAnalysisSchema.parse({ ...req.body, lotId: paramId(req) });
    const warnings = await validateBathAgainstSpec(parsed);
    ok(res, { ...(await addBathAnalysis(parsed)), warnings });
  } catch (e) {
    failCaught(res, e, 'Bath analysis failed');
  }
});

router.post('/stp/bath-analysis', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = stpBathAnalysisSchema.parse(req.body ?? {});
    const warnings = await validateBathAgainstSpec(parsed);
    ok(res, { ...(await addBathAnalysis(parsed)), warnings });
  } catch (e) {
    failCaught(res, e, 'Bath analysis failed');
  }
});

router.post('/stp/lots/:id/chemical-addition', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = stpChemicalAdditionSchema.parse({ ...req.body, lotId: paramId(req) });
    ok(res, await addChemicalAddition(parsed));
  } catch (e) {
    failCaught(res, e, 'Chemical addition failed');
  }
});

router.post('/stp/chemical-addition', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = stpChemicalAdditionSchema.parse(req.body ?? {});
    ok(res, await addChemicalAddition(parsed));
  } catch (e) {
    failCaught(res, e, 'Chemical addition failed');
  }
});

router.post('/stp/lots/:id/coating', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = stpCoatingSchema.parse({ ...req.body, lotId: paramId(req) });
    const { validateRecord, stpRules } = await import('@a59/shared');
    const coatingRules = stpRules.filter((r) => r.field === 'coatingGm2');
    const warnings = validateRecord(coatingRules, { coatingGm2: parsed.coatingGm2 });
    ok(res, { ...(await addCoating(parsed)), warnings });
  } catch (e) {
    failCaught(res, e, 'Coating failed');
  }
});

router.post('/stp/bath-history', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await addBathHistory(stpBathHistorySchema.parse(req.body)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Bath history failed');
  }
});

router.get('/stp/lots/:id/export', requireMachineHead, async (req, res) => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format : 'json';
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.send(await buildStpCsv(paramId(req)));
      return;
    }
    ok(res, await buildStpExport(paramId(req)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Export failed');
  }
});

router.get('/stp/reports', requireMachineHead, (_req, res) => {
  ok(res, listReports('STP'));
});

router.post('/stp/export', requireMachineHead, async (req, res) => {
  try {
    const report = String(req.body?.report ?? 'STP-FT-01A');
    const filters = { ...(req.body?.filters ?? {}), id: req.body?.id };
    const { buffer, filename } = await renderReport(report, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'XLSX export failed');
  }
});

router.get('/stp/session', (req, res) => {
  ok(res, { role: req.appRole, process: 'STP' });
});

export default router;
