import { Router } from 'express';
import {
  authMiddleware,
  requireAuth,
  requireRole,
} from '../middleware/authMiddleware';
import {
  search as pgSearch,
  suggestPostgres,
  TraceNotFoundError,
} from '../services/TraceabilityService';
import * as elastic from '../services/ElasticTraceabilityService';

const router = Router();

const requireTraceability = requireRole('PLANT_HEAD', 'MACHINE_HEAD', 'ADMIN');

router.use('/traceability', authMiddleware, requireAuth, requireTraceability);

function ok(res, data) {
  res.json({ data, errors: null });
}
function fail(res, status, message) {
  res.status(status).json({ data: null, errors: [{ message }] });
}

/**
 * GET /traceability?q=
 * Optional ES fuzzy → top batch → Postgres; else Postgres ILIKE on q.
 */
router.get('/traceability', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return fail(res, 400, 'Missing q');
  }

  try {
    let searchedBy = 'postgres';
    let resolveQ = q;
    let esMatches;

    if (elastic.isAvailable()) {
      const hits = await elastic.search(q);
      if (hits?.length) {
        resolveQ = hits[0].batchNumber || hits[0].coilNo || q;
        searchedBy = 'elasticsearch';
        esMatches = hits.slice(0, 5);
      }
    }

    const payload = await pgSearch(resolveQ, { searchedBy });
    if (esMatches) payload.esMatches = esMatches;
    ok(res, payload);
  } catch (e) {
    if (e instanceof TraceNotFoundError || e?.code === 'TRACE_NOT_FOUND') {
      return fail(res, 404, e.message || 'Not found');
    }
    if (e?.code === 'MISSING_Q') {
      return fail(res, 400, 'Missing q');
    }
    fail(res, 400, e instanceof Error ? e.message : 'Traceability failed');
  }
});

/**
 * GET /traceability/suggest?q=
 * ES completion when up; otherwise Postgres ILIKE suggestions (A59).
 */
router.get('/traceability/suggest', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    return ok(res, []);
  }

  try {
    if (elastic.isAvailable()) {
      const esHits = await elastic.suggest(q);
      if (esHits?.length) return ok(res, esHits);
    }
    ok(res, await suggestPostgres(q));
  } catch (e) {
    fail(res, 400, e instanceof Error ? e.message : 'Suggest failed');
  }
});

export default router;
