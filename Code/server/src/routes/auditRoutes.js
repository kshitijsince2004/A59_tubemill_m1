import { Router } from 'express';
import { authMiddleware, requireAuth, requirePlantHead } from '../middleware/authMiddleware';
import { listAuditEvents } from '../services/AuditTrailService';

const router = Router();
router.use('/audit', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/audit', requirePlantHead, async (req, res) => {
  try {
    ok(
      res,
      await listAuditEvents({
        limit: req.query.limit,
        entityType: req.query.entityType,
        action: req.query.action,
      })
    );
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Audit list failed');
  }
});

export default router;
