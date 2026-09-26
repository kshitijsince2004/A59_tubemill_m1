import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/authStore';

let devRoleOverride = null;
let signingOut = false;
let refreshPromise = null;

export function setDevRoleOverride(role) {
  devRoleOverride = role;
}

export function getDevRoleOverride() {
  return devRoleOverride;
}

/** Web: relative `/api`. Operator APK: absolute plant URL via `VITE_API_BASE`. */
const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

/** Default read/write timeout — weak plant Wi-Fi must not hang the UI for minutes. */
const DEFAULT_TIMEOUT_MS = 15_000;

const SKIP_AUTH_CLEAR = new Set([
  '/auth/badge-pin',
  '/auth/signout',
  '/auth/session/refresh',
]);

export function getApiBase() {
  return BASE;
}

function withTimeout(ms = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

function captureSessionHeaders(res) {
  const access = res.headers.get('st-access-token');
  if (access) setAccessToken(access);
  const refresh = res.headers.get('st-refresh-token');
  if (refresh) setRefreshToken(refresh);
  const auth = res.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    setAccessToken(auth.slice(7));
  }
}

function deviceIdHeader() {
  try {
    let id = sessionStorage.getItem('a59-device-id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('a59-device-id', id);
    }
    return { 'x-device-id': id };
  } catch {
    return {};
  }
}

function authHeaders() {
  const headers = {
    'st-auth-mode': 'header',
    'x-app-version': APP_VERSION,
    ...deviceIdHeader(),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (devRoleOverride) headers['x-app-role'] = devRoleOverride;
  return headers;
}

function shouldAttemptRefresh(path) {
  if (SKIP_AUTH_CLEAR.has(path)) return false;
  if (path.startsWith('/auth/session/')) return false;
  return Boolean(getAccessToken() || getRefreshToken());
}

function isDemoSessionToken(token) {
  return typeof token === 'string' && token.startsWith('a59.1.');
}

async function doRefreshSession() {
  const refresh = getRefreshToken();
  const access = getAccessToken();

  // HMAC demo sessions (Netlify without SuperTokens Core) — never call ST web-js.
  if (isDemoSessionToken(refresh) || isDemoSessionToken(access)) {
    if (!refresh) return false;
    const res = await fetch(`${BASE}/auth/session/refresh`, {
      method: 'POST',
      headers: {
        'st-auth-mode': 'header',
        Authorization: `Bearer ${refresh}`,
      },
    });
    captureSessionHeaders(res);
    return res.ok;
  }

  // Prefer SuperTokens web-js when it already owns a session (staff email login).
  try {
    const { initSuperTokensClient, Session, syncAccessTokenFromSession } = await import(
      '../lib/supertokens'
    );
    initSuperTokensClient();
    if (await Session.doesSessionExist()) {
      const ok = await Session.attemptRefreshingSession();
      if (ok) {
        await syncAccessTokenFromSession();
        return true;
      }
    }
  } catch {
    /* fall through to manual refresh */
  }

  if (!refresh) return false;

  // Header-mode refresh requires Authorization: Bearer <refresh_token>
  // (st-refresh-token alone is rejected as unauthorised).
  const res = await fetch(`${BASE}/auth/session/refresh`, {
    method: 'POST',
    headers: {
      rid: 'session',
      'st-auth-mode': 'header',
      Authorization: `Bearer ${refresh}`,
    },
  });
  captureSessionHeaders(res);
  return res.ok;
}

/** Single-flight refresh so concurrent 401s do not stampede /session/refresh. */
export function tryRefreshSession() {
  if (!refreshPromise) {
    refreshPromise = doRefreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function forceLocalSignOut() {
  clearAuth();
  setDevRoleOverride(null);
  if (signingOut) return;
  signingOut = true;
  void import('../lib/supertokens')
    .then(({ signOutSession }) => signOutSession())
    .finally(() => {
      signingOut = false;
    });
}

function handleUnauthorized(path) {
  if (SKIP_AUTH_CLEAR.has(path)) return;
  // Only wipe local session when we actually held tokens (failed refresh / expired).
  // Bare 401 with no token (e.g. probe before login) must not clear a concurrent login.
  if (!getAccessToken() && !getRefreshToken()) return;
  forceLocalSignOut();
}

async function fetchWithAuth(path, init = {}) {
  const buildHeaders = () => ({
    'Content-Type': 'application/json',
    'x-request-id': crypto.randomUUID(),
    ...authHeaders(),
    ...init?.headers,
  });

  let headers = buildHeaders();
  const method = (init?.method ?? 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  const timeout = withTimeout(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const { timeoutMs: _t, ...rest } = init || {};
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...rest, headers, signal: rest.signal ?? timeout.signal });
  } finally {
    timeout.clear();
  }
  captureSessionHeaders(res);

  if (res.status === 401 && shouldAttemptRefresh(path)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      headers = buildHeaders();
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
        headers['Idempotency-Key'] = crypto.randomUUID();
      }
      const timeout2 = withTimeout(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        res = await fetch(`${BASE}${path}`, {
          ...rest,
          headers,
          signal: rest.signal ?? timeout2.signal,
        });
      } finally {
        timeout2.clear();
      }
      captureSessionHeaders(res);
    }
  }

  if (res.status === 401) {
    handleUnauthorized(path);
  }
  return res;
}

/**
 * Raw fetch for the sync engine — no offline enqueue; caller owns retries.
 * Path may be absolute or API-relative (starting with /).
 */
export async function rawApiFetch(path, init = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-request-id': crypto.randomUUID(),
    ...authHeaders(),
    ...init?.headers,
  };
  const timeout = withTimeout(init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const { timeoutMs: _t, ...rest } = init || {};
  try {
    const res = await fetch(url, { ...rest, headers, signal: rest.signal ?? timeout.signal });
    captureSessionHeaders(res);
    return res;
  } finally {
    timeout.clear();
  }
}

export async function apiRequest(path, init) {
  const method = (init?.method ?? 'GET').toUpperCase();

  if (!navigator.onLine && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...init?.headers,
    };
    if (!headers['Idempotency-Key']) {
      headers['Idempotency-Key'] = crypto.randomUUID();
    }
    const { isOperatorBuild } = await import('../lib/buildFlags');
    if (isOperatorBuild()) {
      const { submitOrQueue } = await import('../offline/syncEngine');
      await submitOrQueue({
        url: path,
        method,
        payload: init?.body,
        aggregateKey: headers['x-aggregate-key'] || `path:${path}`,
        headers,
      });
      throw new Error('Offline — queued for sync');
    }
    const { enqueueOutbox } = await import('../offline/outbox');
    await enqueueOutbox({
      path: `${BASE}${path}`,
      method,
      headers,
      body: init?.body,
    });
    throw new Error('Offline — queued for sync');
  }

  const res = await fetchWithAuth(path, init);
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return await res.text();
  }
  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(
      res.ok
        ? `Invalid JSON from ${path}`
        : `Request failed: ${path} (${res.status}${raw ? ` — ${raw.slice(0, 120)}` : ''})`
    );
  }
  if (!res.ok || json?.errors) {
    const first = json?.errors?.[0];
    const messages = (json?.errors ?? [])
      .map((e) => e?.message)
      .filter(Boolean);
    const err = new Error(
      messages.length ? messages.join('; ') : first?.message ?? `Request failed: ${path}`
    );
    err.status = res.status;
    err.code = first?.code ?? null;
    err.payload = json?.data ?? null;
    err.issues = json?.errors ?? null;
    throw err;
  }
  return json?.data;
}

export async function apiCsv(path) {
  const res = await fetchWithAuth(path);
  if (!res.ok) throw new Error('CSV export failed');
  return res.text();
}
