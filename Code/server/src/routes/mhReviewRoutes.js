import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requireMachineHead,
} from '../middleware/authMiddleware';
import {
  getMachineHeadDashboard,
  listPendingReview,
  getReviewItem,
  reviewAction,
} from '../services/MhReviewService';

const router = Router();
router.use('/reports', authMiddleware, requireAuth);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/reports/machine-head', requireMachineHead, async (req, res) => {
  try {
    ok(res, await getMachineHeadDashboard(req.user));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Dashboard failed');
  }
});

router.get('/reports/machine-head/pending', requireMachineHead, async (req, res) => {
  try {
    ok(res, await listPendingReview(req.user));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Pending list failed');
  }
});

router.get('/reports/machine-head/:process/:id', requireMachineHead, async (req, res) => {
  try {
    const item = await getReviewItem(req.user, req.params.process, req.params.id);
    if (!item) return fail(res, 404, 'Not found');
    ok(res, item);
  } catch (e) {
    if (e?.status) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Detail failed');
  }
});

router.post('/reports/machine-head/:process/:id/:action', requireMachineHead, async (req, res) => {
  try {
    const action = String(req.params.action || '').toLowerCase();
    if (!['approve', 'hold', 'reopen'].includes(action)) {
      return fail(res, 400, 'Action must be approve|hold|reopen');
    }
    ok(
      res,
      await reviewAction(
        req.user,
        req.params.process,
        req.params.id,
        action,
        req.body?.remark ?? req.body?.note
      )
    );
  } catch (e) {
    if (e?.status) return fail(res, e.status, e.message);
    fail(res, 400, e instanceof Error ? e.message : 'Action failed');
  }
});

export default router;
