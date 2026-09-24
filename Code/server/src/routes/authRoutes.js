import { Router } from 'express';
import { config } from '../config';
import { Session, SuperTokens } from '../config/authConfig';
import {
  authMiddleware,
  requireAuth } from

'../middleware/authMiddleware';
import { validateBadgePin, verifySessionPin, verifySupervisorOverridePin } from '../services/authService';

const router = Router();

router.post('/auth/badge-pin', async (req, res) => {
  try {
    const empCode = String(req.body?.empCode ?? req.body?.badge ?? '');
    const pin = String(req.body?.pin ?? '');
    const result = await validateBadgePin(empCode, pin);
    if (!result.ok) {
      res.status(result.status).json({ data: null, errors: [{ message: result.message }] });
      return;
    }

    if (config.superTokensEnabled) {
      await Session.createNewSession(
        req,
        res,
        'public',
        SuperTokens.convertToRecipeUserId(result.stUserId),
        {
          appUserId: result.user.userId,
          username: result.user.username,
          roles: result.user.roles,
          processAccess: result.user.processAccess,
          machineAccess: result.user.machineAccess
        },
        {}
      );
    }

    res.json({
      data: {
        user: result.user,
        tenantId: config.tenantId,
        authMode: config.authMode,
        superTokens: config.superTokensEnabled
      },
      errors: null
    });
  } catch (err) {
    console.error('[auth/badge-pin]', err);
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Login failed' }]
    });
  }
});

router.post('/auth/verify-pin', authMiddleware, requireAuth, async (req, res) => {
  const authed = req;
  const pin = String(req.body?.pin ?? '');
  const result = await verifySessionPin(authed.user.userId, pin);
  if (!result.ok) {
    res.status(result.status).json({ data: null, errors: [{ message: result.message }] });
    return;
  }
  res.json({ data: { ok: true }, errors: null });
});

router.get('/auth/me', authMiddleware, requireAuth, (req, res) => {
  const authed = req;
  res.json({
    data: {
      user: authed.user,
      role: authed.appRole,
      tenantId: config.tenantId,
      authMode: config.authMode,
      superTokens: config.superTokensEnabled,
      collectorMode: config.collectorMode,
      bcAdapter: config.bcAdapter
    },
    errors: null
  });
});

router.post('/auth/supervisor-override', async (req, res) => {
  try {
    const empCode = String(req.body?.empCode ?? req.body?.badge ?? '');
    const pin = String(req.body?.pin ?? '');
    const action = String(req.body?.action ?? 'APPROVE');
    const resourceId = req.body?.resourceId != null ? String(req.body.resourceId) : null;
    const result = await verifySupervisorOverridePin(empCode, pin, { action, resourceId });
    if (!result.ok) {
      res.status(result.status).json({ data: null, errors: [{ message: result.message }] });
      return;
    }
    // Return scoped token only — do not leak full grant objects (audit F10).
    res.json({
      data: {
        ok: true,
        override: result.override,
      },
      errors: null,
    });
  } catch (err) {
    console.error('[auth/supervisor-override]', err);
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Override failed' }],
    });
  }
});

// Always 200 — expired/missing tokens must not 401 and trigger a refresh loop.
// When SuperTokens is enabled, Session.signOut() hits the ST recipe path first;
// this route remains for ST-disabled / legacy clients.
router.post('/auth/signout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (userId) {
      try {
        const { closeActiveSessionsForOperator } = await import(
          '../services/MachineSessionService.js'
        );
        await closeActiveSessionsForOperator(userId);
      } catch (e) {
        console.warn('[auth/signout] session close failed', e instanceof Error ? e.message : e);
      }
    }
    if (config.superTokensEnabled) {
      try {
        const session = await Session.getSession(req, res, { sessionRequired: false });
        if (session) await session.revokeSession();
      } catch {
        /* expired / try-refresh / already gone — still signed out locally */
      }
    }
    res.json({ data: { ok: true }, errors: null });
  } catch (err) {
    res.status(500).json({
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Sign out failed' }]
    });
  }
});

export default router;