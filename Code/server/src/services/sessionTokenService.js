/**
 * HMAC session tokens for Netlify/demo when SuperTokens Core is not configured.
 * Format: a59.1.<base64url(payload)>.<base64url(hmac)>
 * Compatible with client capture of st-access-token / st-refresh-token headers.
 */
import crypto from 'crypto';
import { config } from '../config';

const ACCESS_TTL_SEC = 8 * 60 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

export function sessionSigningKey() {
  if (process.env.SESSION_SECRET && String(process.env.SESSION_SECRET).trim()) {
    return String(process.env.SESSION_SECRET).trim();
  }
  if (config.serviceToken && config.serviceToken !== 'dev-service-token') {
    return config.serviceToken;
  }
  // Stable demo key derived from Netlify DB URL so sessions work without extra env.
  const material = process.env.NETLIFY_DB_URL || config.databaseUrl || 'a59-local-dev';
  return crypto.createHash('sha256').update(`a59-session|${material}`).digest('hex');
}

function sign(payloadB64) {
  return b64url(
    crypto.createHmac('sha256', sessionSigningKey()).update(`a59.1.${payloadB64}`).digest()
  );
}

function issue(typ, userId, extra = {}, ttlSec) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ,
    sub: String(userId),
    iat: now,
    exp: now + ttlSec,
    ...extra,
  };
  const body = b64urlJson(payload);
  return `a59.1.${body}.${sign(body)}`;
}

/**
 * @param {{ userId: string, username?: string, primaryRole?: string, roles?: string[] }} user
 */
export function issueAccessToken(user) {
  return issue(
    'access',
    user.userId,
    {
      username: user.username ?? null,
      primaryRole: user.primaryRole ?? null,
      roles: user.roles ?? [],
    },
    ACCESS_TTL_SEC
  );
}

export function issueRefreshToken(user) {
  return issue('refresh', user.userId, {}, REFRESH_TTL_SEC);
}

/**
 * @param {string} token
 * @param {'access'|'refresh'} [expectTyp]
 */
export function verifySessionToken(token, expectTyp) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'a59' || parts[1] !== '1') return null;
  const payloadPart = parts[2];
  const sigPart = parts[3];
  const expected = sign(payloadPart);
  const a = Buffer.from(expected);
  const b = Buffer.from(sigPart);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadPart).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.sub || !payload?.exp || !payload?.typ) return null;
  if (expectTyp && payload.typ !== expectTyp) return null;
  if (payload.exp * 1000 < Date.now()) return null;
  return payload;
}

export function isA59SessionToken(token) {
  return typeof token === 'string' && token.startsWith('a59.1.');
}

export function attachSessionHeaders(res, user) {
  const access = issueAccessToken(user);
  const refresh = issueRefreshToken(user);
  res.setHeader('st-access-token', access);
  res.setHeader('st-refresh-token', refresh);
  res.setHeader(
    'Access-Control-Expose-Headers',
    [
      'st-access-token',
      'st-refresh-token',
      'front-token',
      'anti-csrf',
      'id-refresh-token',
      'x-request-id',
    ].join(', ')
  );
  return { access, refresh };
}
