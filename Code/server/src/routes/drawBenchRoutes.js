import { Router } from 'express';
import {
  drwCreateSchema,
  drwUpdateSchema,
  drwShiftCheckSchema,
  drwInspectionSchema,
  drwToolingIssueSchema,
  drwToolingUsageSchema,
  drwSwageSchema,
} from '@a59/shared';
import {
  listDrwLots,
  getDrwLot,
  createDrwLot,
  updateDrwLot,
  setDrwStatus,
  addShiftCheck,
  addInspection,
  addToolingIssue,
  addToolingUsage,
  assertDrwInspectionsDispositioned,
  updateInspectionDisposition,
  createSwage,
  listDrawBenches,
  listTooling,
  suggestDbBench,
  checkDbEligibility,
  buildDrwValidationMaster,
  getPaintColour,
  findDrwLotByPassKey,
  getDrawBenchBoard,
  assignDrawBenchOrder,
} from '../services/DrawBenchService';
import { buildDrawBenchExport, buildDrawBenchCsv } from '../services/DrawBenchExportService';
import { listReports, renderReport } from '../export/ReportExportService';
import { claimHttpIdempotency } from '../services/RunService';
import { assertValid, ValidationError } from '../services/ValidationGate';
import { assertMachineApproval } from '../auth/machineAccessPolicy';
import {
  authMiddleware,
  requireAuth,
  requireProcessAccess,
  requireMachineHead,
  requireWritable,
} from '../middleware/authMiddleware';

const router = Router();
router.use('/drawbench', authMiddleware, requireAuth);
router.use('/drawbench', (req, res, next) => {
  const level = req.method === 'GET' || req.method === 'HEAD' ? 'READ' : 'WRITE';
  requireProcessAccess('DRW', level)(req, res, next);
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
  if (e?.issues) return fail(res, 422, e.message, e.issues);
  fail(res, 400, e instanceof Error ? e.message : fallback);
}

async function withIdempotency(req, res, next) {
  const key = req.header('Idempotency-Key');
  if (!key) return next();
  const claimed = await claimHttpIdempotency(`http:${req.method}:${req.path}`, key);
  if (!claimed) return fail(res, 409, 'Duplicate Idempotency-Key');
  return next();
}

function numQuery(v) {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

router.get('/drawbench/machines', async (_req, res) => {
  ok(res, await listDrawBenches());
});

router.get('/drawbench/board', async (_req, res) => {
  try {
    ok(res, await getDrawBenchBoard());
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Board failed');
  }
});

router.post('/drawbench/board/:benchCode/assign', requireWritable, withIdempotency, async (req, res) => {
  try {
    const benchCode = Array.isArray(req.params.benchCode) ? req.params.benchCode[0] : req.params.benchCode;
    const lot = await assignDrawBenchOrder(benchCode, req.body ?? {});
    const eligibility = await checkDbEligibility(benchCode, {
      odMm: lot.finalOdMm ?? lot.finalSize?.odMm,
      thkMm: lot.finalThMm ?? lot.finalSize?.thkMm,
    });
    ok(res, { ...lot, eligibility });
  } catch (e) {
    failCaught(res, e, 'Assign failed');
  }
});

router.get('/drawbench/tooling', async (_req, res) => {
  ok(res, await listTooling());
});

router.get('/drawbench/benches/suggest', async (req, res) => {
  try {
    ok(
      res,
      await suggestDbBench({
        odMm: numQuery(req.query.od),
        thkMm: numQuery(req.query.thk),
        fromOdMm: numQuery(req.query.fromOd),
        fromThMm: numQuery(req.query.fromThk),
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Suggest failed');
  }
});

router.get('/drawbench/benches/eligibility', async (req, res) => {
  try {
    const benchCode = typeof req.query.benchCode === 'string' ? req.query.benchCode : '';
    ok(
      res,
      await checkDbEligibility(benchCode, {
        odMm: numQuery(req.query.od),
        thkMm: numQuery(req.query.thk),
        fromOdMm: numQuery(req.query.fromOd),
        fromThMm: numQuery(req.query.fromThk),
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Eligibility check failed');
  }
});

router.get('/drawbench/paint-colour', async (req, res) => {
  try {
    const grade = typeof req.query.grade === 'string' ? req.query.grade : '';
    ok(res, { gradeCode: grade, paintColour: await getPaintColour(grade) });
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Paint lookup failed');
  }
});

router.get('/drawbench/lots', async (req, res) => {
  try {
    ok(
      res,
      await listDrwLots({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        benchCode: typeof req.query.benchCode === 'string' ? req.query.benchCode : undefined,
        workOrderNo: typeof req.query.workOrderNo === 'string' ? req.query.workOrderNo : undefined,
        drawPass: typeof req.query.drawPass === 'string' ? req.query.drawPass : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'List failed');
  }
});

router.get('/drawbench/lots/:id', async (req, res) => {
  const lot = await getDrwLot(paramId(req));
  if (!lot) return fail(res, 404, 'Not found');
  ok(res, lot);
});

router.post('/drawbench/lots', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = drwCreateSchema.parse(req.body);
    const row = {
      ...parsed,
      fromOdMm: parsed.fromOdMm ?? parsed.fromSize?.odMm,
      fromThMm: parsed.fromThMm ?? parsed.fromSize?.thkMm,
      toOdMm: parsed.toOdMm ?? parsed.toSize?.odMm,
      toThMm: parsed.toThMm ?? parsed.toSize?.thkMm,
      passType: parsed.stage,
    };
    const master = await buildDrwValidationMaster(parsed.benchCode, parsed.gradeCode);
    const warnings = await assertValid('DRW', row, { master });

    // Multi-pass dedup: reuse open lot for same WO+pass+bench
    const existing = await findDrwLotByPassKey(parsed.workOrderNo, parsed.drawPass, parsed.benchCode);
    if (existing) {
      const updated = await updateDrwLot(existing.id, parsed);
      const eligibility = await checkDbEligibility(parsed.benchCode, {
        odMm: row.toOdMm,
        thkMm: row.toThMm,
        fromOdMm: row.fromOdMm,
        fromThMm: row.fromThMm,
      });
      return ok(res, { ...updated, warnings, eligibility, deduped: true });
    }

    const created = await createDrwLot(parsed);
    const eligibility = await checkDbEligibility(parsed.benchCode, {
      odMm: row.toOdMm,
      thkMm: row.toThMm,
      fromOdMm: row.fromOdMm,
      fromThMm: row.fromThMm,
    });
    ok(res, { ...created, warnings, eligibility });
  } catch (e) {
    failCaught(res, e, 'Create failed');
  }
});

router.put('/drawbench/lots/:id', requireWritable, withIdempotency, async (req, res) => {
  try {
    const parsed = drwUpdateSchema.partial().parse({ ...req.body, id: paramId(req) });
    const row = {
      ...parsed,
      fromOdMm: parsed.fromOdMm ?? parsed.fromSize?.odMm,
      fromThMm: parsed.fromThMm ?? parsed.fromSize?.thkMm,
      toOdMm: parsed.toOdMm ?? parsed.toSize?.odMm,
      toThMm: parsed.toThMm ?? parsed.toSize?.thkMm,
      passType: parsed.stage,
    };
    const existing = await getDrwLot(paramId(req));
    const master = await buildDrwValidationMaster(
      parsed.benchCode ?? existing?.benchCode,
      parsed.gradeCode ?? existing?.gradeCode
    );
    const warnings = await assertValid('DRW', { ...existing, ...row }, { master });
    const updated = await updateDrwLot(paramId(req), parsed);
    const eligibility = await checkDbEligibility(updated.benchCode, {
      odMm: updated.toOdMm,
      thkMm: updated.toThMm,
      fromOdMm: updated.fromOdMm,
      fromThMm: updated.fromThMm,
    });
    ok(res, { ...updated, warnings, eligibility });
  } catch (e) {
    failCaught(res, e, 'Update failed');
  }
});

router.post('/drawbench/lots/:id/submit', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await setDrwStatus(paramId(req), 'SUBMITTED'));
  } catch (e) {
    failCaught(res, e, 'Submit failed');
  }
});

router.post('/drawbench/lots/:id/approve', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const lot = await getDrwLot(paramId(req));
    if (!lot) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, lot.benchCode);
    await assertDrwInspectionsDispositioned(paramId(req));
    ok(res, await setDrwStatus(paramId(req), 'APPROVED'));
  } catch (e) {
    if (e?.status === 403 || e?.status === 401 || e?.status === 422) {
      return fail(res, e.status, e.message);
    }
    fail(res, 400, e instanceof Error ? e.message : 'Approve failed');
  }
});

router.post('/drawbench/lots/:id/shift-check', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await addShiftCheck(drwShiftCheckSchema.parse({ ...req.body, lotId: paramId(req) })));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Shift check failed');
  }
});

router.post('/drawbench/lots/:id/inspection', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await addInspection(drwInspectionSchema.parse({ ...req.body, lotId: paramId(req) })));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Inspection failed');
  }
});

router.post('/drawbench/lots/:id/tooling-issue', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const lot = await getDrwLot(paramId(req));
    if (!lot) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, lot.benchCode);
    ok(res, await addToolingIssue(drwToolingIssueSchema.parse({ ...req.body, lotId: paramId(req) })));
  } catch (e) {
    if (e?.status === 403 || e?.status === 401) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Tooling issue failed');
  }
});

router.post('/drawbench/lots/:id/inspection/:inspId/disposition', requireMachineHead, withIdempotency, async (req, res) => {
  try {
    const lot = await getDrwLot(paramId(req));
    if (!lot) return fail(res, 404, 'Not found');
    assertMachineApproval(req.user, lot.benchCode);
    const inspId = Array.isArray(req.params.inspId) ? req.params.inspId[0] : req.params.inspId;
    ok(
      res,
      await updateInspectionDisposition(inspId, String(req.body?.disposition ?? ''), paramId(req))
    );
  } catch (e) {
    if (e?.status === 403 || e?.status === 401) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Disposition failed');
  }
});

router.post('/drawbench/lots/:id/tooling-usage', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await addToolingUsage(drwToolingUsageSchema.parse({ ...req.body, lotId: paramId(req) })));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Tooling usage failed');
  }
});

router.post('/drawbench/swage', requireWritable, withIdempotency, async (req, res) => {
  try {
    ok(res, await createSwage(drwSwageSchema.parse(req.body)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Swage failed');
  }
});

router.get('/drawbench/lots/:id/export', async (req, res) => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format : 'json';
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.send(await buildDrawBenchCsv(paramId(req)));
      return;
    }
    ok(res, await buildDrawBenchExport(paramId(req)));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Export failed');
  }
});

router.get('/drawbench/reports', (_req, res) => {
  ok(res, listReports('DRW'));
});

router.post('/drawbench/export', async (req, res) => {
  try {
    const report = String(req.body?.report ?? 'DB-FT-01');
    const filters = { ...(req.body?.filters ?? {}), id: req.body?.id, dieCode: req.body?.dieCode };
    const { buffer, filename } = await renderReport(report, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'XLSX export failed');
  }
});

router.get('/drawbench/session', (req, res) => {
  ok(res, { role: req.appRole, process: 'DRW' });
});

export default router;
