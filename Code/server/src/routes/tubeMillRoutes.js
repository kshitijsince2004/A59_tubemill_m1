import { Router } from 'express';
import {
  openRunSchema,
  tmSetupSchema,
  tmCoilInputSchema,
  tmBundleSchema,
  tmFirstOffSchema,
  tmStoppageCodeSchema,
  tmParamManualSchema,
  tmMillParamManualSchema,
  tmMillSetupSchema,
  tmArcWeldSchema,
  tmEdgeMillSchema,
  tmDefectSchema,
  tmHoldSchema,
  tmRemarkSchema,
  tmManualStopSchema,
  tmOnlineInspectionSchema,
  tmProductionQuantitiesSchema,
  tmEndRunSchema } from
'@a59/shared';

import { getQueue, mapQueueCard } from '../services/QueueService';
import {
  openRun,
  getRun,
  addCoilInput,
  addBundle,
  submitRun,
  approveRun,
  lockRun,
  getCoils,
  getBundles,
  getStoppages,
  updateRunState,
  updateFirstOff,
  holdRun,
  resumeRun,
  appendRemark,
  startProduction,
  endProduction,
  rollChange,
  listRuns,
  claimHttpIdempotency,
  updateProductionQuantities } from
'../services/RunService';
import { saveSetup } from '../services/SetupService';
import {
  getLive,
  saveParamManual,
  listParamSnapshots,
  codeStoppage,
  setForceOutOfBand,
  getExceptions } from
'../services/MockMachineService';
import {
  listParamReadings,
  saveMillParamManual,
  getMillLiveParams,
  getParameterContext } from
'../services/MillParamService';
import {
  listMillSetups,
  getMillSetup,
  createMillSetup,
  chartPrefill } from
'../services/MillSetupService';
import { transition } from '../services/StateMachine';
import { ingestHttpEvent } from '../services/CollectorIngestService';
import {
  listConsumables,
  getConsumable,
  recordInspection,
  getUsageHistory,
  applyRunUsage,
  isChangeDue } from
'../services/ConsumableUsageService';
import { reconcileYield } from '../services/YieldReconciliationService';
import { buildDprExport, buildShiftSummary, buildDprCsv } from '../services/DprExportService';
import { syncPlanToQueue, writeActuals } from '../services/BcWritebackClient';
import { shiftBoundary, openShift, listShifts } from '../services/ShiftHandoverService';
import {
  addDefect,
  listDefects,
  listDefectCodes,
  addArcWeld,
  listArcWelds,
  addEdgeMill,
  listEdgeMills,
  manualStop,
  getLiveStatusSummary,
  addOnlineInspection,
  listOnlineInspections } from
'../services/CaptureExtrasService';
import { query } from '../db/pool';
import { config } from '../config';
import {
  authMiddleware,
  requireAuth,
  requireProcessAccess,
  requireMachineHead,
  requireAdmin,
  requireWritable,
  requireServiceToken,
  requireDevSim } from

'../middleware/authMiddleware';
import { stopCollectorForRun } from '../collector/CollectorRunner';
import { publishSetupApproved } from '../events/DomainEvents';
import { assertMachineApproval } from '../auth/machineAccessPolicy';

const router = Router();

function paramId(req) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function ok(res, data) {
  res.json({ data, errors: null });
}

function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

/** Public — no auth (must be registered before requireAuth). */
router.get('/health', async (_req, res) => {
  let db = 'ok';
  let dbError;
  try {
    await query(`SELECT 1 AS ok`);
  } catch (err) {
    db = 'error';
    dbError = err instanceof Error ? err.message : String(err);
  }
  ok(res, {
    status: db === 'ok' ? 'ok' : 'degraded',
    db,
    dbError,
    hasNetlifyDbUrl: Boolean(process.env.NETLIFY_DB_URL),
    hasRemoteDatabaseUrl: Boolean(
      process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL)
    ),
    databaseUrlIsLocalhost: /localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL ?? ''),
    context: process.env.CONTEXT ?? null,
    fix:
    db === 'ok' ?
    null :
    'Create Netlify Database (Data & Storage → Database) OR set DATABASE_URL to a Neon/Supabase URL (not localhost). Then redeploy.',
    collectorMode: config.collectorMode,
    bcAdapter: config.bcAdapter
  });
});

router.get('/tubemill/session', authMiddleware, (req, res) => {
  const authed = req;
  ok(res, {
    role: authed.appRole ?? config.staticAppRole,
    user: authed.user ?? null,
    authMode: config.authMode,
    collectorMode: config.collectorMode,
    bcAdapter: config.bcAdapter,
    tenantId: config.tenantId,
    superTokens: config.superTokensEnabled,
    allowHeaderRole: config.allowHeaderRole
  });
});

router.use('/tubemill', authMiddleware);
router.use('/tubemill', (req, res, next) => {
  const path = `${req.baseUrl || ''}${req.path || ''}`;
  if (path.includes('/tubemill/session')) {
    next();
    return;
  }
  requireAuth(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    const level = req.method === 'GET' || req.method === 'HEAD' ? 'READ' : 'WRITE';
    requireProcessAccess('TM', level)(req, res, next);
  });
});
router.use('/internal', authMiddleware);

/** Optional Idempotency-Key header for mutating writes */
async function withIdempotency(req, res, next) {
  const key = req.header('Idempotency-Key');
  if (!key) return next();
  const scope = `http:${req.method}:${req.path}`;
  const claimed = await claimHttpIdempotency(scope, key);
  if (!claimed) {
    return fail(res, 409, 'Duplicate Idempotency-Key');
  }
  return next();
}

router.get('/tubemill/queue', async (req, res) => {
  try {
    const mill = req.query.mill ?? 'A-59';
    const cards = await getQueue(mill);
    ok(res, cards.map(mapQueueCard));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Queue fetch failed');
  }
});

router.get('/tubemill/runs', async (req, res) => {
  try {
    ok(res, await listRuns(req.query.mill ?? 'A-59', Number(req.query.limit ?? 50)));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'List runs failed');
  }
});

router.get('/tubemill/live-status', async (req, res) => {
  try {
    ok(res, await getLiveStatusSummary(req.query.mill ?? 'A-59'));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Live status failed');
  }
});

// --- Independent Parameters (machine-scoped, no run) ---
router.get('/tubemill/params', async (req, res) => {
  try {
    ok(res, await listParamReadings(req.query.mill ?? 'A-59', Number(req.query.limit ?? 100)));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Param readings failed');
  }
});

/** Running-order + setup context for Parameter Console auto-population (read-only). */
router.get('/tubemill/params/context', async (req, res) => {
  try {
    ok(res, await getParameterContext(req.query.mill ?? 'A-59'));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Param context failed');
  }
});

router.get('/tubemill/params/live', async (req, res) => {
  try {
    ok(res, await getMillLiveParams(req.query.mill ?? 'A-59'));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Mill live params failed');
  }
});

router.post('/tubemill/params', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmMillParamManualSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await saveMillParamManual(parsed.data.millCode ?? 'A-59', parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Param save failed');
  }
});

// --- Independent Setup (machine-scoped, no run) ---
router.get('/tubemill/setups', async (req, res) => {
  try {
    ok(res, await listMillSetups(req.query.mill ?? 'A-59', Number(req.query.limit ?? 50)));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Setup list failed');
  }
});

router.get('/tubemill/setups/chart-prefill', async (req, res) => {
  try {
    const sizeKey = String(req.query.sizeKey ?? '');
    const thkMm = Number(req.query.thkMm ?? 0);
    const gradeCode = String(req.query.gradeCode ?? '');
    if (!sizeKey || !thkMm || !gradeCode) {
      return fail(res, 400, 'sizeKey, thkMm, and gradeCode are required');
    }
    const prefill = await chartPrefill(sizeKey, thkMm, gradeCode);
    if (!prefill) return fail(res, 404, 'No TM-02 chart entry for size/grade/thk');
    ok(res, prefill);
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Chart prefill failed');
  }
});

router.get('/tubemill/setups/:id', async (req, res) => {
  try {
    const setup = await getMillSetup(paramId(req));
    if (!setup) return fail(res, 404, 'Setup not found');
    ok(res, setup);
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Setup fetch failed');
  }
});

router.post('/tubemill/setups', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmMillSetupSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await createMillSetup(parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Setup create failed');
  }
});

router.post('/tubemill/runs', requireWritable, withIdempotency, async (req, res) => {
  const parsed = openRunSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    const run = await openRun(parsed.data.queueCardId, parsed.data.millCode, parsed.data.setupType);
    ok(res, run);
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Open run failed');
  }
});

router.get('/tubemill/runs/:id', async (req, res) => {
  const run = await getRun(paramId(req));
  if (!run) return fail(res, 404, 'Run not found');
  ok(res, run);
});

router.post('/tubemill/runs/:id/setup', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmSetupSchema.safeParse({ ...req.body, runId: paramId(req) });
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await saveSetup(paramId(req), parsed.data, req.appRole));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Setup save failed');
  }
});

router.post('/tubemill/runs/:id/first-off', requireMachineHead, withIdempotency, async (req, res) => {
  const parsed = tmFirstOffSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    const id = paramId(req);
    const run = await getRun(id);
    if (!run) return fail(res, 404, 'Run not found');
    assertMachineApproval(req.user, run.millCode);
    if (run.runState !== 'FIRST_OFF_PENDING') return fail(res, 400, 'Run is not awaiting first-off');
    await updateFirstOff(id, parsed.data.result, parsed.data.approvedBy);
    if (parsed.data.result === 'PASS') {
      await updateRunState(id, transition(run.runState, 'FIRST_OFF_PASS'));
    }
    await publishSetupApproved({
      runId: id,
      setupId: run.setupId ?? id,
      firstOffResult: parsed.data.result,
      approvedBy: parsed.data.approvedBy,
      approvedAt: new Date().toISOString()
    });
    ok(res, await getRun(id));
  } catch (err) {
    if (err?.status === 403 || err?.status === 401) return fail(res, err.status, err.message);
    fail(res, 400, err instanceof Error ? err.message : 'First-off failed');
  }
});

router.post('/tubemill/runs/:id/coils', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmCoilInputSchema.safeParse({ ...req.body, runId: paramId(req) });
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await addCoilInput(paramId(req), parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Coil add failed');
  }
});

router.post('/tubemill/runs/:id/bundles', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmBundleSchema.safeParse({ ...req.body, runId: paramId(req) });
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await addBundle(paramId(req), parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Bundle add failed');
  }
});

router.post('/tubemill/runs/:id/inspections', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmOnlineInspectionSchema.safeParse({ ...req.body, runId: paramId(req) });
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await addOnlineInspection(paramId(req), parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Inspection failed');
  }
});

router.get('/tubemill/runs/:id/inspections', async (req, res) => {
  ok(res, await listOnlineInspections(paramId(req)));
});

router.post('/tubemill/runs/:id/hold', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmHoldSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await holdRun(paramId(req), parsed.data.remark));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Hold failed');
  }
});

router.post('/tubemill/runs/:id/resume', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmHoldSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await resumeRun(paramId(req), parsed.data.remark));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Resume failed');
  }
});

router.post('/tubemill/runs/:id/remark', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmRemarkSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await appendRemark(paramId(req), parsed.data.remark));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Remark failed');
  }
});

router.post('/tubemill/runs/:id/start', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await startProduction(paramId(req)));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Start failed');
  }
});

router.put('/tubemill/runs/:id/production', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmProductionQuantitiesSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await updateProductionQuantities(paramId(req), parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Production update failed');
  }
});

router.post('/tubemill/runs/:id/end', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmEndRunSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await endProduction(paramId(req), parsed.data.remark));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'End failed');
  }
});

router.post('/tubemill/runs/:id/roll-change', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await rollChange(paramId(req)));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Roll change failed');
  }
});

router.post('/tubemill/runs/:id/manual-stop', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmManualStopSchema.safeParse(req.body ?? {});
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await manualStop(paramId(req), parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Manual stop failed');
  }
});

router.post('/tubemill/runs/:id/defects', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmDefectSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await addDefect(paramId(req), parsed.data, req.appRole));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Defect failed');
  }
});

router.get('/tubemill/runs/:id/defects', async (req, res) => {
  ok(res, await listDefects(paramId(req)));
});

router.post('/tubemill/runs/:id/arcweld', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmArcWeldSchema.safeParse({ ...req.body, runId: paramId(req) });
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await addArcWeld(parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Arc weld failed');
  }
});

router.get('/tubemill/runs/:id/arcweld', async (req, res) => {
  ok(res, await listArcWelds(paramId(req)));
});

router.post('/tubemill/runs/:id/edgemill', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmEdgeMillSchema.safeParse({ ...req.body, runId: paramId(req) });
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await addEdgeMill(paramId(req), parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Edge mill failed');
  }
});

router.get('/tubemill/runs/:id/edgemill', async (req, res) => {
  ok(res, await listEdgeMills(paramId(req)));
});

router.get('/tubemill/runs/:id/live', async (req, res) => {
  try {
    const live = await getLive(paramId(req));
    if (!live) return fail(res, 404, 'Run not found');
    ok(res, live);
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Live fetch failed');
  }
});

router.get('/tubemill/runs/:id/exceptions', async (req, res) => {
  ok(res, await getExceptions(paramId(req)));
});

router.post('/tubemill/runs/:id/param-manual', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmParamManualSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await saveParamManual(paramId(req), parsed.data));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Param manual save failed');
  }
});

router.get('/tubemill/runs/:id/param-snapshots', async (req, res) => {
  try {
    ok(res, await listParamSnapshots(paramId(req)));
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Param snapshots fetch failed');
  }
});

router.post('/tubemill/runs/:id/submit', requireWritable, withIdempotency, async (req, res) => {
  try {
    const id = paramId(req);
    const usage = await applyRunUsage(id);
    const run = await submitRun(id);
    stopCollectorForRun(id);
    ok(res, { ...run, consumableUsage: usage });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Submit failed');
  }
});

router.post('/tubemill/runs/:id/approve', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const run = await getRun(paramId(req));
    if (!run) return fail(res, 404, 'Run not found');
    assertMachineApproval(req.user, run.millCode);
    ok(res, await approveRun(paramId(req)));
  } catch (err) {
    if (err?.status === 403 || err?.status === 401) return fail(res, err.status, err.message);
    fail(res, 400, err instanceof Error ? err.message : 'Approve failed');
  }
});

router.post('/tubemill/runs/:id/lock', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const run = await getRun(paramId(req));
    if (!run) return fail(res, 404, 'Run not found');
    assertMachineApproval(req.user, run.millCode);
    ok(res, await lockRun(paramId(req)));
  } catch (err) {
    if (err?.status === 403 || err?.status === 401) return fail(res, err.status, err.message);
    fail(res, 400, err instanceof Error ? err.message : 'Lock failed');
  }
});

router.get('/tubemill/runs/:id/yield', async (req, res) => {
  try {
    ok(res, await reconcileYield(paramId(req)));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Yield failed');
  }
});

router.get('/tubemill/runs/:id/export', async (req, res) => {
  try {
    const format = req.query.format ?? 'dpr';
    if (format === 'csv') {
      const csv = await buildDprCsv(paramId(req));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="dpr-${paramId(req)}.csv"`);
      return res.send(csv);
    }
    const data = format === 'shift-summary' ? await buildShiftSummary(paramId(req)) : await buildDprExport(paramId(req));
    ok(res, data);
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Export failed');
  }
});

router.post('/tubemill/export', requireMachineHead, async (req, res) => {
  try {
    const { renderReport } = await import('../export/ReportExportService.js');
    const report = String(req.body?.report ?? 'TM-FT-02');
    const filters = { ...(req.body?.filters ?? {}), id: req.body?.id };
    const { buffer, filename } = await renderReport(report, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'XLSX export failed');
  }
});

router.post('/tubemill/runs/:id/writeback', requireAdmin, withIdempotency, async (req, res) => {
  try {
    ok(res, await writeActuals(paramId(req)));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Writeback failed');
  }
});

router.post('/tubemill/stoppages/:id/code', requireWritable, withIdempotency, async (req, res) => {
  const parsed = tmStoppageCodeSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, parsed.error.message);
  try {
    ok(res, await codeStoppage(paramId(req), parsed.data.stoppageCode, parsed.data.reason, parsed.data.remark));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Stoppage code failed');
  }
});

router.get('/tubemill/runs/:id/coils', async (req, res) => {
  ok(res, await getCoils(paramId(req)));
});

router.get('/tubemill/runs/:id/bundles', async (req, res) => {
  ok(res, await getBundles(paramId(req)));
});

router.get('/tubemill/runs/:id/stoppages', async (req, res) => {
  ok(res, await getStoppages(paramId(req)));
});

router.post(
  '/tubemill/runs/:id/mock/out-of-band',
  requireDevSim,
  requireWritable,
  (req, res) => {
    const force = Boolean(req.body?.force);
    setForceOutOfBand(paramId(req), force);
    ok(res, { force });
  }
);

router.get('/tubemill/stoppage-codes', async (_req, res) => {
  const codes = await query(
    `SELECT code, label, category, is_planned FROM master.stoppage_code WHERE tenant_id = $1 ORDER BY code`,
    [config.tenantId]
  );
  ok(res, codes);
});

router.get('/tubemill/defect-codes', async (_req, res) => {
  ok(res, await listDefectCodes());
});

router.get('/tubemill/consumables', async (_req, res) => {
  const rows = await listConsumables();
  ok(
    res,
    rows.map((r) => ({
      ...r,
      changeDue: isChangeDue(r)
    }))
  );
});

router.get('/tubemill/consumables/:code', async (req, res) => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const row = await getConsumable(code);
  if (!row) return fail(res, 404, 'Not found');
  ok(res, { ...row, changeDue: isChangeDue(row), history: await getUsageHistory(code) });
});

router.post('/tubemill/consumables/:code/inspect', requireWritable, withIdempotency, async (req, res) => {
  try {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
    ok(
      res,
      await recordInspection(code, String(req.body?.visualInspection ?? ''), String(req.body?.action ?? 'INSPECT'), req.body?.runId)
    );
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Inspect failed');
  }
});

router.post('/tubemill/erp/sync-plan', requireAdmin, withIdempotency, async (req, res) => {
  try {
    const mill = req.body?.millCode ?? 'A-59';
    ok(res, await syncPlanToQueue(mill));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'ERP sync failed');
  }
});

router.post('/tubemill/shifts/open', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await openShift(req.body?.millCode ?? 'A-59', req.body?.shiftCode ?? 'A'));
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Open shift failed');
  }
});

router.post('/tubemill/shifts/boundary', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    ok(
      res,
      await shiftBoundary(req.body?.millCode ?? 'A-59', req.body?.nextShiftCode ?? 'B')
    );
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Shift boundary failed');
  }
});

router.get('/tubemill/shifts', async (req, res) => {
  ok(res, await listShifts(req.query.mill ?? 'A-59'));
});

router.get('/tubemill/param-chart', async (_req, res) => {
  const rows = await query(`SELECT * FROM master.tm_param_chart WHERE tenant_id = $1 AND is_active = true ORDER BY size_key, thk_mm`, [
  config.tenantId]
  );
  ok(res, rows);
});

router.patch('/tubemill/param-chart/:id', requireAdmin, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { power_kw_min, power_kw_max, speed_min_mpm, speed_max_mpm, is_active } = req.body ?? {};
  const row = await query(
    `UPDATE master.tm_param_chart SET
      power_kw_min = COALESCE($2, power_kw_min),
      power_kw_max = COALESCE($3, power_kw_max),
      speed_min_mpm = COALESCE($4, speed_min_mpm),
      speed_max_mpm = COALESCE($5, speed_max_mpm),
      is_active = COALESCE($6, is_active)
     WHERE id = $1 AND tenant_id = $7
     RETURNING *`,
    [id, power_kw_min ?? null, power_kw_max ?? null, speed_min_mpm ?? null, speed_max_mpm ?? null, is_active ?? null, config.tenantId]
  );
  ok(res, row[0] ?? null);
});

router.post('/internal/tubemill/ingest', requireServiceToken, async (req, res) => {
  try {
    const event = String(req.body?.event ?? '');
    const payload = req.body?.payload;
    if (!event) return fail(res, 400, 'event required');
    await ingestHttpEvent(event, payload);
    ok(res, { accepted: true });
  } catch (err) {
    fail(res, 400, err instanceof Error ? err.message : 'Ingest failed');
  }
});

export default router;