import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requirePlantReports,
  requirePlantHead,
} from '../middleware/authMiddleware';
import {
  getPlantHeadDashboard,
  getPlantHeadBacklog,
  getPlantHeadTrend,
  getStageThroughput,
  getManagementDashboard,
  getDailyReport,
  getPlantHeadDrilldown,
  searchCoilTraceability,
  suggestCoils,
  getMachineHandoverSummary,
  getProductionIntelligence,
  getDefectIntelligence,
  getDowntimeIntelligence,
  getOrderTracking,
} from '../services/PlantReportingService';

const router = Router();
router.use('/reports', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/reports/plant-head', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getPlantHeadDashboard(req.query.windowDays));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Plant dashboard failed');
  }
});

router.get('/reports/plant-head/backlog', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getPlantHeadBacklog());
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Backlog failed');
  }
});

router.get('/reports/plant-head/trend', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getPlantHeadTrend(req.query.windowDays));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Plant trend failed');
  }
});

router.get('/reports/plant-head/stages', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getStageThroughput(req.query.windowDays));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Stage throughput failed');
  }
});

router.get('/reports/management', requirePlantHead, async (req, res) => {
  try {
    ok(res, await getManagementDashboard(req.query.period));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Management dashboard failed');
  }
});

router.get('/reports/drilldown', requirePlantReports, async (req, res) => {
  try {
    ok(
      res,
      await getPlantHeadDrilldown({
        metric: req.query.metric,
        process: req.query.process,
        machine: req.query.machine,
        shift: req.query.shift,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Drilldown failed');
  }
});

router.get('/reports/daily', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getDailyReport(req.query.date));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Daily report failed');
  }
});

router.get('/reports/coil-traceability', requirePlantReports, async (req, res) => {
  try {
    ok(res, await searchCoilTraceability(req.query.coilNo ?? req.query.q));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Traceability failed');
  }
});

router.get('/reports/coil-suggest', requirePlantReports, async (req, res) => {
  try {
    ok(res, await suggestCoils(req.query.q));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Suggest failed');
  }
});

router.get('/reports/handover', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getMachineHandoverSummary(req.query.millCode ?? 'A-59'));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Handover failed');
  }
});

router.get('/reports/production', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getProductionIntelligence(req.query.windowDays));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Production intel failed');
  }
});

router.get('/reports/defects', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getDefectIntelligence(req.query.windowDays));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Defect intel failed');
  }
});

router.get('/reports/downtime', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getDowntimeIntelligence(req.query.windowDays));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Downtime intel failed');
  }
});

router.get('/reports/orders', requirePlantReports, async (req, res) => {
  try {
    ok(res, await getOrderTracking());
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Orders failed');
  }
});

export default router;
