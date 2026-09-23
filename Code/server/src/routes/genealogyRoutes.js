import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requireWritable } from
'../middleware/authMiddleware';
import {
  listUpstreamLots,
  attachMaterialLot,
  getGenealogy } from
'../services/GenealogyService';
import {
  listProcessStoppages,
  openProcessStoppage,
  closeProcessStoppage,
  listStoppageCodes } from
'../services/ProcessStoppageService';

const router = Router();
router.use('/genealogy', authMiddleware, requireAuth);
router.use('/stoppages', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/genealogy/upstream', async (req, res) => {
  try {
    const toProcess = typeof req.query.process === 'string' ? req.query.process : 'FUR';
    const workOrderNo =
    typeof req.query.workOrderNo === 'string' ? req.query.workOrderNo : undefined;
    ok(res, await listUpstreamLots({ toProcess, workOrderNo }));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Upstream list failed');
  }
});

router.get('/genealogy/:id', async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const g = await getGenealogy(id);
  if (!g) return fail(res, 404, 'Not found');
  ok(res, g);
});

router.post('/genealogy/attach', requireWritable, async (req, res) => {
  try {
    ok(
      res,
      await attachMaterialLot({
        materialLotId: String(req.body.materialLotId),
        toProcess: String(req.body.toProcess),
        toRecordId: String(req.body.toRecordId),
        fromProcess: req.body.fromProcess ? String(req.body.fromProcess) : undefined,
        handedBy: req.body.handedBy ? String(req.body.handedBy) : undefined
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Attach failed');
  }
});

router.get('/stoppages/codes', async (req, res) => {
  const prefix = typeof req.query.process === 'string' ? req.query.process : undefined;
  ok(res, await listStoppageCodes(prefix));
});

router.get('/stoppages', async (req, res) => {
  try {
    const processCode = String(req.query.process ?? '');
    const sourceId = String(req.query.sourceId ?? '');
    if (!processCode || !sourceId) return fail(res, 400, 'process and sourceId required');
    ok(res, await listProcessStoppages(processCode, sourceId));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'List failed');
  }
});

router.post('/stoppages/open', requireWritable, async (req, res) => {
  try {
    ok(
      res,
      await openProcessStoppage({
        processCode: String(req.body.processCode),
        sourceId: String(req.body.sourceId),
        stoppageCode: String(req.body.stoppageCode),
        reason: req.body.reason ? String(req.body.reason) : undefined,
        millCode: req.body.millCode ? String(req.body.millCode) : undefined
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Open failed');
  }
});

router.post('/stoppages/close', requireWritable, async (req, res) => {
  try {
    ok(
      res,
      await closeProcessStoppage(String(req.body.processCode), String(req.body.sourceId))
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Close failed');
  }
});

export default router;