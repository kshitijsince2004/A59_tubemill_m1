const BASE = '/api';

import { clearAuth, getAccessToken, setAccessToken } from '../lib/authStore';

/** Dev-only role override sent as x-app-role when no SuperTokens session. */
let devRoleOverride = null;

export function setDevRoleOverride(role) {
  devRoleOverride = role;
}

export function getDevRoleOverride() {
  return devRoleOverride;
}

function captureSessionHeaders(res) {
  const access = res.headers.get('st-access-token');
  if (access) setAccessToken(access);
  const auth = res.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    setAccessToken(auth.slice(7));
  }
}

async function request(path, init) {
  const headers = {
    'Content-Type': 'application/json',
    ...init?.headers,
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (devRoleOverride) headers['x-app-role'] = devRoleOverride;
  headers['st-auth-mode'] = 'header';

  const method = (init?.method ?? 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  if (!navigator.onLine && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const { enqueueOutbox } = await import('../offline/outbox');
    await enqueueOutbox({ path: `${BASE}${path}`, method, headers, body: init?.body });
    throw new Error('Offline — queued for sync');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });
  captureSessionHeaders(res);
  if (res.status === 401 && !path.includes('/session') && path !== '/auth/badge-pin') {
    clearAuth();
    setDevRoleOverride(null);
    void import('../lib/supertokens').then(({ signOutSession }) => signOutSession()).catch(() => undefined);
  }
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return await res.text();
  }
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Request failed: ${path}`);
  }
  return json.data;
}






































































































export const tubemillApi = {
  getSession: () => request('/tubemill/session'),
  getQueue: (mill = 'A-59') => request(`/tubemill/queue?mill=${mill}`),
  listRuns: (mill = 'A-59') => request(`/tubemill/runs?mill=${mill}`),
  getLiveStatus: (mill = 'A-59') => request(`/tubemill/live-status?mill=${mill}`),
  openRun: (queueCardId, millCode = 'A-59') =>
  request('/tubemill/runs', {
    method: 'POST',
    body: JSON.stringify({ queueCardId, millCode, setupType: 'INITIAL' })
  }),
  getRun: (id) => request(`/tubemill/runs/${id}`),
  saveSetup: (runId, body) =>
  request(`/tubemill/runs/${runId}/setup`, { method: 'POST', body: JSON.stringify(body) }),
  firstOff: (runId, result, approvedBy) =>
  request(`/tubemill/runs/${runId}/first-off`, {
    method: 'POST',
    body: JSON.stringify({ result, approvedBy })
  }),
  addCoil: (runId, body) =>
  request(`/tubemill/runs/${runId}/coils`, { method: 'POST', body: JSON.stringify(body) }),
  addBundle: (runId, body) =>
  request(`/tubemill/runs/${runId}/bundles`, { method: 'POST', body: JSON.stringify(body) }),
  getLive: (runId) => request(`/tubemill/runs/${runId}/live`),
  getExceptions: (runId) => request(`/tubemill/runs/${runId}/exceptions`),
  getCoils: (runId) => request(`/tubemill/runs/${runId}/coils`),
  getBundles: (runId) => request(`/tubemill/runs/${runId}/bundles`),
  getStoppages: (runId) => request(`/tubemill/runs/${runId}/stoppages`),
  getStoppageCodes: () => request('/tubemill/stoppage-codes'),
  getDefectCodes: () => request('/tubemill/defect-codes'),
  codeStoppage: (id, stoppageCode, reason) =>
  request(`/tubemill/stoppages/${id}/code`, {
    method: 'POST',
    body: JSON.stringify({ stoppageCode, reason })
  }),
  saveParamManual: (runId, body) =>
  request(`/tubemill/runs/${runId}/param-manual`, { method: 'POST', body: JSON.stringify(body) }),
  listParamSnapshots: (runId) => request(`/tubemill/runs/${runId}/param-snapshots`),
  /** Independent Parameters (mill-scoped) */
  listMillParams: (mill = 'A-59') => request(`/tubemill/params?mill=${mill}`),
  getParamContext: (mill = 'A-59') => request(`/tubemill/params/context?mill=${mill}`),
  getMillParamsLive: (mill = 'A-59') => request(`/tubemill/params/live?mill=${mill}`),
  saveMillParam: (body) =>
  request('/tubemill/params', { method: 'POST', body: JSON.stringify(body) }),
  /** Independent Setup (mill-scoped) */
  listMillSetups: (mill = 'A-59') => request(`/tubemill/setups?mill=${mill}`),
  getMillSetup: (id) => request(`/tubemill/setups/${id}`),
  createMillSetup: (body) =>
  request('/tubemill/setups', { method: 'POST', body: JSON.stringify(body) }),
  chartPrefill: (sizeKey, thkMm, gradeCode) =>
  request(
    `/tubemill/setups/chart-prefill?sizeKey=${encodeURIComponent(sizeKey)}&thkMm=${encodeURIComponent(thkMm)}&gradeCode=${encodeURIComponent(gradeCode)}`
  ),
  holdRun: (runId, remark) =>
  request(`/tubemill/runs/${runId}/hold`, { method: 'POST', body: JSON.stringify({ remark }) }),
  resumeRun: (runId, remark) =>
  request(`/tubemill/runs/${runId}/resume`, { method: 'POST', body: JSON.stringify({ remark }) }),
  addRemark: (runId, remark) =>
  request(`/tubemill/runs/${runId}/remark`, { method: 'POST', body: JSON.stringify({ remark }) }),
  startRun: (runId) => request(`/tubemill/runs/${runId}/start`, { method: 'POST' }),
  updateProduction: (runId, body) =>
  request(`/tubemill/runs/${runId}/production`, {
    method: 'PUT',
    body: JSON.stringify(body ?? {})
  }),
  endRun: (runId, remark) =>
  request(`/tubemill/runs/${runId}/end`, {
    method: 'POST',
    body: JSON.stringify({ remark })
  }),
  rollChange: (runId) => request(`/tubemill/runs/${runId}/roll-change`, { method: 'POST' }),
  manualStop: (runId, body) =>
  request(`/tubemill/runs/${runId}/manual-stop`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  addDefect: (runId, body) =>
  request(`/tubemill/runs/${runId}/defects`, { method: 'POST', body: JSON.stringify(body) }),
  getDefects: (runId) => request(`/tubemill/runs/${runId}/defects`),
  addArcWeld: (runId, body) =>
  request(`/tubemill/runs/${runId}/arcweld`, { method: 'POST', body: JSON.stringify(body) }),
  getArcWelds: (runId) => request(`/tubemill/runs/${runId}/arcweld`),
  addEdgeMill: (runId, body) =>
  request(`/tubemill/runs/${runId}/edgemill`, { method: 'POST', body: JSON.stringify(body) }),
  getEdgeMills: (runId) => request(`/tubemill/runs/${runId}/edgemill`),
  addInspection: (runId, body) =>
  request(`/tubemill/runs/${runId}/inspections`, { method: 'POST', body: JSON.stringify(body) }),
  getInspections: (runId) =>
  request(`/tubemill/runs/${runId}/inspections`),
  submitRun: (runId) => request(`/tubemill/runs/${runId}/submit`, { method: 'POST' }),
  approveRun: (runId) => request(`/tubemill/runs/${runId}/approve`, { method: 'POST' }),
  lockRun: (runId) => request(`/tubemill/runs/${runId}/lock`, { method: 'POST' }),
  getYield: (runId) => request(`/tubemill/runs/${runId}/yield`),
  exportRun: (runId, format = 'dpr') =>
  request(`/tubemill/runs/${runId}/export?format=${format}`),
  exportCsv: async (runId) => {
    const headers = {};
    if (devRoleOverride) headers['x-app-role'] = devRoleOverride;
    const res = await fetch(`${BASE}/tubemill/runs/${runId}/export?format=csv`, { headers });
    if (!res.ok) throw new Error('CSV export failed');
    return res.text();
  },
  getConsumables: () => request('/tubemill/consumables'),
  inspectConsumable: (code, visualInspection, action, runId) =>
  request(`/tubemill/consumables/${code}/inspect`, {
    method: 'POST',
    body: JSON.stringify({ visualInspection, action, runId })
  }),
  syncPlan: () => request('/tubemill/erp/sync-plan', { method: 'POST', body: '{}' }),
  writeback: (runId) => request(`/tubemill/runs/${runId}/writeback`, { method: 'POST' }),
  openShift: (shiftCode = 'A') =>
  request('/tubemill/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ millCode: 'A-59', shiftCode })
  }),
  listShifts: () => request('/tubemill/shifts?mill=A-59'),
  shiftBoundary: (nextShiftCode = 'B') =>
  request('/tubemill/shifts/boundary', {
    method: 'POST',
    body: JSON.stringify({ millCode: 'A-59', nextShiftCode })
  }),
  getParamChart: () => request('/tubemill/param-chart'),
  patchParamChart: (id, body) =>
  request(`/tubemill/param-chart/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  })
};