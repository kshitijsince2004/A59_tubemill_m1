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

const BASE = '/api';

const SKIP_AUTH_CLEAR = new Set([
  '/auth/badge-pin',
  '/auth/signout',
  '/auth/session/refresh',
]);

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

function authHeaders() {
  const headers = {
    'st-auth-mode': 'header',
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

async function doRefreshSession() {
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

  const refresh = getRefreshToken();
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
    ...authHeaders(),
    ...init?.headers,
  });

  let headers = buildHeaders();
  const method = (init?.method ?? 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  let res = await fetch(`${BASE}${path}`, { ...init, headers });
  captureSessionHeaders(res);

  if (res.status === 401 && shouldAttemptRefresh(path)) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      headers = buildHeaders();
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
        headers['Idempotency-Key'] = crypto.randomUUID();
      }
      res = await fetch(`${BASE}${path}`, { ...init, headers });
      captureSessionHeaders(res);
    }
  }

  if (res.status === 401) {
    handleUnauthorized(path);
  }
  return res;
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
