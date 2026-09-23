import { clearAuth, getAccessToken, setAccessToken } from '../lib/authStore';

let devRoleOverride = null;
let signingOut = false;

export function setDevRoleOverride(role) {
  devRoleOverride = role;
}

export function getDevRoleOverride() {
  return devRoleOverride;
}

const BASE = '/api';

function captureSessionHeaders(res) {
  const access = res.headers.get('st-access-token');
  if (access) setAccessToken(access);
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

function handleUnauthorized(res, path) {
  if (res.status !== 401) return;
  // Login probe — leave tokens alone so the form can still submit.
  if (path === '/auth/badge-pin') return;
  clearAuth();
  setDevRoleOverride(null);
  if (!signingOut) {
    signingOut = true;
    void import('../lib/supertokens')
      .then(({ signOutSession }) => signOutSession())
      .finally(() => {
        signingOut = false;
      });
  }
}

export async function apiRequest(path, init) {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...init?.headers,
  };

  const method = (init?.method ?? 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  if (!navigator.onLine && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const { enqueueOutbox } = await import('../offline/outbox');
    await enqueueOutbox({
      path: `${BASE}${path}`,
      method,
      headers,
      body: init?.body,
    });
    throw new Error('Offline — queued for sync');
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  captureSessionHeaders(res);
  handleUnauthorized(res, path);
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return await res.text();
  }
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Request failed: ${path}`);
  }
  return json.data;
}

export async function apiCsv(path) {
  const headers = authHeaders();
  const res = await fetch(`${BASE}${path}`, { headers });
  captureSessionHeaders(res);
  handleUnauthorized(res, path);
  if (!res.ok) throw new Error('CSV export failed');
  return res.text();
}
