import { Router } from 'express';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/authMiddleware';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  listEntityTypes,
} from '../services/MasterDataService';

const router = Router();
router.use('/master-data', authMiddleware, requireAuth);

function ok(res, data, status = 200) {
  res.status(status).json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/master-data', (_req, res) => {
  ok(res, listEntityTypes());
});

router.get('/master-data/:entityType', async (req, res) => {
  try {
    ok(res, await listEntities(req.params.entityType));
  } catch (e) {
    fail(res, e?.status || 500, e instanceof Error ? e.message : 'List failed');
  }
});

router.post('/master-data/:entityType', requireAdmin, async (req, res) => {
  try {
    ok(res, await createEntity(req.params.entityType, req.body ?? {}), 201);
  } catch (e) {
    fail(res, e?.status || 400, e instanceof Error ? e.message : 'Create failed');
  }
});

router.put('/master-data/:entityType/:id', requireAdmin, async (req, res) => {
  try {
    ok(res, await updateEntity(req.params.entityType, req.params.id, req.body ?? {}));
  } catch (e) {
    fail(res, e?.status || 400, e instanceof Error ? e.message : 'Update failed');
  }
});

router.delete('/master-data/:entityType/:id', requireAdmin, async (req, res) => {
  try {
    ok(res, await deleteEntity(req.params.entityType, req.params.id));
  } catch (e) {
    fail(res, e?.status || 400, e instanceof Error ? e.message : 'Delete failed');
  }
});

export default router;
