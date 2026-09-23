import { Router } from 'express';
import { authMiddleware, requireAuth, requireAdmin, requireRole } from '../middleware/authMiddleware';
import { syncEntities, getErpHealth, listReleasedOrders } from '../erp/ErpSyncService';
import { flushWriteback } from '../erp/ErpWritebackService';
import { listWatermarks as listWm } from '../erp/watermarks';

const router = Router();
router.use('/erp', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}

function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/erp/health', async (_req, res) => {
  try {
    ok(res, await getErpHealth());
  } catch (e) {
    fail(res, 500, e instanceof Error ? e.message : 'ERP health failed');
  }
});

router.get('/erp/watermarks', async (_req, res) => {
  try {
    const rows = await listWm();
    ok(
      res,
      rows.map((w) => ({
        entity: w.entity,
        lastCursor: w.last_cursor,
        lastRunAt: w.last_run_at,
        status: w.status,
        rowCount: w.row_count,
        lastError: w.last_error
      }))
    );
  } catch (e) {
    fail(res, 500, e instanceof Error ? e.message : 'Watermarks failed');
  }
});

router.get('/erp/orders', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'Released';
    ok(res, await listReleasedOrders(status));
  } catch (e) {
    fail(res, 500, e instanceof Error ? e.message : 'Orders failed');
  }
});

router.post('/erp/sync', requireRole('ADMIN', 'MACHINE_HEAD'), async (req, res) => {
  try {
    const entities = Array.isArray(req.body?.entities) ?
    req.body.entities :
    undefined;
    const mill = typeof req.body?.millCode === 'string' ? req.body.millCode : 'A-59';
    ok(res, await syncEntities(entities, mill));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Sync failed');
  }
});

router.post('/erp/writeback/flush', requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.body?.limit ?? 50);
    ok(res, await flushWriteback(Number.isFinite(limit) ? limit : 50));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Flush failed');
  }
});

export default router;