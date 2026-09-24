import crypto from 'crypto';
import { ROLE_RANK } from '@a59/shared';
import { config } from '../config';
import { Session } from '../config/authConfig';
import { loadGrantsBySuperTokensUserId, loadGrantsByUserId, verifyOverrideToken } from '../services/authService';
import { isA59SessionToken, verifySessionToken } from '../services/sessionTokenService';

const VALID_ROLES = ['OPERATOR', 'MACHINE_HEAD', 'PLANT_HEAD', 'ADMIN'];

const PROCESS_LEVEL_RANK = {
  READ: 1,
  WRITE: 2,
  APPROVE: 3
};

const MACHINE_LEVEL_RANK = {
  READ: 1,
  WRITE: 2,
  MANAGE: 3
};

function parseRole(raw) {
  const upper = (raw ?? 'OPERATOR').toUpperCase();
  return VALID_ROLES.includes(upper) ? upper : 'OPERATOR';
}

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    const max = Math.max(bufA.length, bufB.length, 1);
    const pa = Buffer.alloc(max);
    const pb = Buffer.alloc(max);
    bufA.copy(pa);
    bufB.copy(pb);
    crypto.timingSafeEqual(pa, pb);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function hasRoleAtLeast(user, min) {
  if (!user) return false;
  if (user.roles.includes('ADMIN') || user.primaryRole === 'ADMIN') return true;
  return ROLE_RANK[user.primaryRole] >= ROLE_RANK[min];
}

export function userHasProcessAccess(
user,
processCode,
level)
{
  if (!user) return false;
  if (user.roles.includes('ADMIN')) return true;
  if (user.roles.includes('PLANT_HEAD') && level === 'READ') return true;
  const grant = user.processAccess.find((g) => g.processCode === processCode);
  if (!grant) {
    // Plant-wide machine heads with no ACL rows: deny (must be granted)
    return false;
  }
  return PROCESS_LEVEL_RANK[grant.level] >= PROCESS_LEVEL_RANK[level];
}

export function userHasMachineAccess(
user,
machineCode,
level)
{
  if (!user) return false;
  if (user.roles.includes('ADMIN')) return true;
  if (user.roles.includes('PLANT_HEAD') && level === 'READ') return true;
  const grant = user.machineAccess.find((g) => g.machineCode === machineCode);
  if (!grant) return false;
  return MACHINE_LEVEL_RANK[grant.level] >= MACHINE_LEVEL_RANK[level];
}

async function hydrateFromHeader(req) {
  // Defense in depth: never trust header/static roles in production.
  if (config.isProduction || !config.allowHeaderRole) return false;
  const header = req.header('x-app-role') || req.header('x-demo-role');
  if (!header) {
    if (config.authMode === 'static') {
      req.appRole = config.staticAppRole;
      req.user = {
        userId: 'static',
        username: 'static',
        fullName: 'Static Role',
        empCode: null,
        email: null,
        roles: [config.staticAppRole],
        primaryRole: config.staticAppRole,
        processAccess: [
        { processCode: 'TM', level: 'APPROVE' },
        { processCode: 'FUR', level: 'APPROVE' },
        { processCode: 'STP', level: 'APPROVE' },
        { processCode: 'DRW', level: 'APPROVE' },
        { processCode: 'SWG', level: 'APPROVE' }],

        machineAccess: []
      };
      return true;
    }
    return false;
  }
  const role = parseRole(header);
  req.appRole = role;
  req.user = {
    userId: 'dev-header',
    username: 'dev',
    fullName: 'Dev Header Role',
    empCode: null,
    email: null,
    roles: [role],
    primaryRole: role,
    processAccess: [
    { processCode: 'TM', level: 'APPROVE' },
    { processCode: 'FUR', level: 'APPROVE' },
    { processCode: 'STP', level: 'APPROVE' },
    { processCode: 'DRW', level: 'APPROVE' },
    { processCode: 'SWG', level: 'APPROVE' }],

    machineAccess: []
  };
  return true;
}

/**
 * Prefer SuperTokens session; else HMAC demo session (Netlify without ST Core);
 * fall back to header/static only when allowed.
 * Expired access tokens throw TRY_REFRESH_TOKEN — let the ST error handler
 * tell the client to refresh (do not swallow into anonymous).
 */
export async function authMiddleware(req, res, next) {
  const authed = req;
  authed.tenantId = config.tenantId;

  try {
    if (config.superTokensEnabled) {
      const session = await Session.getSession(req, res, { sessionRequired: false });
      if (session) {
        const stUserId = session.getUserId();
        const payload = session.getAccessTokenPayload() ?? {};
        let user =
          (await loadGrantsBySuperTokensUserId(stUserId)) ??
          (payload.appUserId ? await loadGrantsByUserId(String(payload.appUserId)) : null);

        // Last resort: session payload already carries grants from createNewSession /
        // mergeIntoAccessTokenPayload — keeps floor APIs alive if DB link lags.
        if (!user && (payload.appUserId || payload.username || Array.isArray(payload.roles))) {
          const roles = Array.isArray(payload.roles)
            ? payload.roles.map((r) => String(r).toUpperCase())
            : ['OPERATOR'];
          const primary =
            roles.includes('ADMIN')
              ? 'ADMIN'
              : roles.includes('PLANT_HEAD')
                ? 'PLANT_HEAD'
                : roles.includes('MACHINE_HEAD')
                  ? 'MACHINE_HEAD'
                  : roles[0] || 'OPERATOR';
          user = {
            userId: String(payload.appUserId || stUserId),
            username: payload.username ?? 'operator',
            fullName: payload.fullName ?? payload.username ?? 'Operator',
            empCode: payload.empCode ?? null,
            email: payload.email ?? null,
            roles,
            primaryRole: primary,
            processAccess: Array.isArray(payload.processAccess) ? payload.processAccess : [],
            machineAccess: Array.isArray(payload.machineAccess) ? payload.machineAccess : [],
          };
        }

        if (user) {
          authed.user = user;
          authed.appRole = user.primaryRole;
          authed.accessTokenPayload = payload;
          next();
          return;
        }
        // Session token present but no app grants — treat as anonymous so
        // public probes (e.g. /tubemill/session) still work; requireAuth 401s later.
      }
    } else if (config.demoSessionsEnabled) {
      const auth = req.header('authorization') || '';
      const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
      if (bearer && isA59SessionToken(bearer)) {
        const payload = verifySessionToken(bearer, 'access');
        if (payload?.sub) {
          const user = await loadGrantsByUserId(payload.sub);
          if (user) {
            authed.user = user;
            authed.appRole = user.primaryRole;
            authed.accessTokenPayload = payload;
            next();
            return;
          }
        }
      }
    }

    const ok = await hydrateFromHeader(authed);
    if (!ok) {
      // Unauthenticated — leave user unset; requireAuth will 401
      authed.appRole = 'OPERATOR';
      authed.user = null;
    }
    next();
  } catch (err) {
    // SuperTokens TRY_REFRESH_TOKEN / UNAUTHORISED must reach stErrorHandler
    // so the browser can call /api/auth/session/refresh and retry.
    next(err);
  }
}

export function requireAuth(req, res, next) {
  const authed = req;
  if (!authed.user) {
    res.status(401).json({ data: null, errors: [{ message: 'Unauthenticated' }] });
    return;
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const authed = req;
    if (!authed.user) {
      res.status(401).json({ data: null, errors: [{ message: 'Unauthenticated' }] });
      return;
    }
    if (authed.user.roles.includes('ADMIN') || roles.some((r) => authed.user.roles.includes(r))) {
      next();
      return;
    }
    res.status(403).json({ data: null, errors: [{ message: `Requires ${roles.join(' or ')}` }] });
  };
}

/** Desk roles: Machine Head + Plant Head escalation + Admin. */
export function requireMachineHead(req, res, next) {
  requireRole('MACHINE_HEAD', 'PLANT_HEAD', 'ADMIN')(req, res, next);
}

/**
 * Machine Head role OR a valid short-lived x-override-token for the action (audit F10).
 * @param {string} [action='APPROVE']
 * @param {(req: import('express').Request) => string | undefined} [getResourceId]
 */
export function requireMachineHeadOrOverride(action = 'APPROVE', getResourceId) {
  return async (req, res, next) => {
    const authed = req;
    if (authed.user && (
      authed.user.roles.includes('ADMIN') ||
      authed.user.roles.includes('MACHINE_HEAD') ||
      authed.user.roles.includes('PLANT_HEAD')
    )) {
      next();
      return;
    }
    try {
      const token = req.header('x-override-token') || '';
      const resourceId = getResourceId ? getResourceId(req) : req.params?.id;
      const verified = verifyOverrideToken(token, { action, resourceId });
      if (verified) {
        authed.override = verified;
        next();
        return;
      }
    } catch (err) {
      next(err);
      return;
    }
    if (!authed.user) {
      res.status(401).json({ data: null, errors: [{ message: 'Unauthenticated' }] });
      return;
    }
    res.status(403).json({
      data: null,
      errors: [{ message: 'Requires MACHINE_HEAD or a valid override token' }],
    });
  };
}

/** Plant / management report readers. */
export function requirePlantReports(req, res, next) {
  requireRole('PLANT_HEAD', 'MACHINE_HEAD', 'ADMIN')(req, res, next);
}

/** Plant Head + Admin only (management rollups, audit). */
export function requirePlantHead(req, res, next) {
  requireRole('PLANT_HEAD', 'ADMIN')(req, res, next);
}

export function requireAdmin(req, res, next) {
  requireRole('ADMIN')(req, res, next);
}

export function requireWritable(req, res, next) {
  const role = req.appRole ?? 'OPERATOR';
  if (role === 'PLANT_HEAD') {
    res.status(403).json({ data: null, errors: [{ message: 'PLANT_HEAD is read-only' }] });
    return;
  }
  next();
}

export function requireProcessAccess(processCode, level = 'WRITE') {
  return (req, res, next) => {
    const authed = req;
    if (!authed.user) {
      res.status(401).json({ data: null, errors: [{ message: 'Unauthenticated' }] });
      return;
    }
    if (level !== 'READ' && authed.appRole === 'PLANT_HEAD') {
      res.status(403).json({ data: null, errors: [{ message: 'PLANT_HEAD is read-only' }] });
      return;
    }
    if (!userHasProcessAccess(authed.user, processCode, level)) {
      res.status(403).json({
        data: null,
        errors: [{ message: `Requires ${level} on process ${processCode}` }]
      });
      return;
    }
    next();
  };
}

export function requireMachineAccess(
getMachineCode,
level = 'WRITE')
{
  return (req, res, next) => {
    const authed = req;
    if (!authed.user) {
      res.status(401).json({ data: null, errors: [{ message: 'Unauthenticated' }] });
      return;
    }
    if (authed.user.roles.includes('ADMIN')) {
      next();
      return;
    }
    if (level !== 'READ' && authed.appRole === 'PLANT_HEAD') {
      res.status(403).json({ data: null, errors: [{ message: 'PLANT_HEAD is read-only' }] });
      return;
    }
    const code = getMachineCode(req);
    if (!code) {
      // No machine in request — process-level check is enough
      next();
      return;
    }
    // ADMIN already returned; PLANT_HEAD read OK without machine grant
    if (authed.user.roles.includes('PLANT_HEAD') && level === 'READ') {
      next();
      return;
    }
    // If user has no machine grants at all, allow when process access granted (plant-wide ops)
    if (authed.user.machineAccess.length === 0) {
      next();
      return;
    }
    if (!userHasMachineAccess(authed.user, code, level)) {
      res.status(403).json({
        data: null,
        errors: [{ message: `Requires ${level} on machine ${code}` }]
      });
      return;
    }
    next();
  };
}

export function requireMinRole(min) {
  return (req, res, next) => {
    const authed = req;
    if (!authed.user || !hasRoleAtLeast(authed.user, min)) {
      res.status(403).json({ data: null, errors: [{ message: `Requires ${min} or higher` }] });
      return;
    }
    next();
  };
}

export function requireServiceToken(req, res, next) {
  const token = req.header('x-service-token') ?? '';
  if (!config.serviceToken || !timingSafeEqualString(token, config.serviceToken)) {
    res.status(401).json({ data: null, errors: [{ message: 'Service token required' }] });
    return;
  }
  next();
}

export function requireDevSim(req, res, next) {
  if (config.authMode !== 'dev' || config.collectorMode !== 'sim') {
    res.status(404).json({ data: null, errors: [{ message: 'Not available' }] });
    return;
  }
  next();
}

/** @deprecated Use authMiddleware; kept for resolve helpers */
export function resolveAppRole(req) {
  return req.appRole ?? parseRole(req.header('x-app-role') || undefined);
}
