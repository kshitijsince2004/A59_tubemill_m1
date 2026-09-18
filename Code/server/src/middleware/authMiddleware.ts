import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import type { AppRole } from '@a59/shared';
import { config } from '../config';

export type AuthedRequest = Request & {
  appRole: AppRole;
  tenantId: string;
};

const VALID_ROLES: AppRole[] = ['OPERATOR', 'SUPERVISOR', 'PLANT_HEAD', 'ADMIN'];

function parseRole(raw: string | undefined): AppRole {
  const upper = (raw ?? 'OPERATOR').toUpperCase();
  return (VALID_ROLES.includes(upper as AppRole) ? upper : 'OPERATOR') as AppRole;
}

function timingSafeEqualString(a: string, b: string): boolean {
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

export function resolveAppRole(req: Request): AppRole {
  if (config.authMode === 'static') {
    return config.staticAppRole;
  }
  // Dev only: accept x-app-role (or legacy x-demo-role) from client
  const header = req.header('x-app-role') || req.header('x-demo-role') || 'OPERATOR';
  return parseRole(header);
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // M-1: never trust x-tenant-id from client
  (req as AuthedRequest).appRole = resolveAppRole(req);
  (req as AuthedRequest).tenantId = config.tenantId;
  next();
}

export function requireSupervisor(req: Request, res: Response, next: NextFunction): void {
  const role = (req as AuthedRequest).appRole ?? 'OPERATOR';
  if (role === 'SUPERVISOR' || role === 'ADMIN') {
    next();
    return;
  }
  res.status(403).json({ data: null, errors: [{ message: 'Requires SUPERVISOR or ADMIN' }] });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = (req as AuthedRequest).appRole ?? 'OPERATOR';
  if (role === 'ADMIN') {
    next();
    return;
  }
  res.status(403).json({ data: null, errors: [{ message: 'Requires ADMIN' }] });
}

export function requireWritable(req: Request, res: Response, next: NextFunction): void {
  const role = (req as AuthedRequest).appRole ?? 'OPERATOR';
  if (role === 'PLANT_HEAD') {
    res.status(403).json({ data: null, errors: [{ message: 'PLANT_HEAD is read-only' }] });
    return;
  }
  next();
}

export function requireServiceToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.header('x-service-token') ?? '';
  if (!config.serviceToken || !timingSafeEqualString(token, config.serviceToken)) {
    res.status(401).json({ data: null, errors: [{ message: 'Service token required' }] });
    return;
  }
  next();
}

export function requireDevSim(req: Request, res: Response, next: NextFunction): void {
  if (config.authMode !== 'dev' || config.collectorMode !== 'sim') {
    res.status(404).json({ data: null, errors: [{ message: 'Not available' }] });
    return;
  }
  next();
}
