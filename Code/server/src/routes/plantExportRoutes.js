import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requirePlantReports,
} from '../middleware/authMiddleware';
import {
  listPlantReports,
  listExportHistory,
  runPlantFtExport,
  runLineLogExport,
} from '../services/PlantExportService';

const router = Router();
router.use('/plant', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/plant/exports/reports', requirePlantReports, (_req, res) => {
  ok(res, listPlantReports());
});

router.get('/plant/exports/history', requirePlantReports, async (req, res) => {
  try {
    ok(res, await listExportHistory(req.query.limit));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'History failed');
  }
});

router.post('/plant/exports/ft', requirePlantReports, async (req, res) => {
  try {
    const report = String(req.body?.report ?? '');
    const id = req.body?.id;
    if (!report || !id) return fail(res, 400, 'report and id required');
    const result = await runPlantFtExport(req.user, { report, id });
    if (result?.buffer) {
      res.setHeader('Content-Type', result.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename || result.fileName || 'export.xlsx'}"`);
      return res.send(result.buffer);
    }
    ok(res, result);
  } catch (e) {
    fail(res, e?.status || 400, e instanceof Error ? e.message : 'Export failed');
  }
});

router.post('/plant/exports/line-log', requirePlantReports, async (req, res) => {
  try {
    const process = String(req.body?.process ?? req.body?.processCode ?? '').toUpperCase();
    const result = await runLineLogExport(req.user, process, req.body?.windowDays);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.buffer);
  } catch (e) {
    fail(res, e?.status || 400, e instanceof Error ? e.message : 'Line log export failed');
  }
});

export default router;
