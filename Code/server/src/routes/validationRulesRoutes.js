import { Router } from 'express';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/authMiddleware';
import {
  listValidationRules,
  getValidationRulesVersion,
  upsertValidationRule,
  deleteValidationRule,
} from '../services/ValidationConfigService';

const router = Router();
router.use('/validation-rules', authMiddleware, requireAuth);

function ok(res, data, status = 200) {
  res.status(status).json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

router.get('/validation-rules/version', async (_req, res) => {
  try {
    ok(res, await getValidationRulesVersion());
  } catch (e) {
    // Table may not exist yet — return 0
    ok(res, 0);
  }
});

router.get('/validation-rules', async (req, res) => {
  try {
    const processCode =
      typeof req.query.processCode === 'string' ? req.query.processCode : undefined;
    ok(res, await listValidationRules(processCode));
  } catch (e) {
    fail(res, e?.status || 500, e instanceof Error ? e.message : 'List failed');
  }
});

router.post('/validation-rules', requireAdmin, async (req, res) => {
  try {
    ok(res, await upsertValidationRule(req.body ?? {}), 201);
  } catch (e) {
    fail(res, e?.status || 400, e instanceof Error ? e.message : 'Upsert failed');
  }
});

router.delete('/validation-rules/:ruleId', requireAdmin, async (req, res) => {
  try {
    ok(res, await deleteValidationRule(req.params.ruleId));
  } catch (e) {
    fail(res, e?.status || 400, e instanceof Error ? e.message : 'Delete failed');
  }
});

export default router;
