const BASE = '/api';

/** Dev-only role override sent as x-app-role when AUTH_MODE=dev. Ignored in static/prod. */
let devRoleOverride: string | null = null;

export function setDevRoleOverride(role: string | null) {
  devRoleOverride = role;
}

export function getDevRoleOverride(): string | null {
  return devRoleOverride;
}

type MutatingMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (devRoleOverride) {
    headers['x-app-role'] = devRoleOverride;
  }

  const method = (init?.method ?? 'GET').toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  // Offline outbox for mutating calls
  if (!navigator.onLine && (['POST', 'PATCH', 'PUT', 'DELETE'] as string[]).includes(method)) {
    const { enqueueOutbox } = await import('../offline/outbox');
    await enqueueOutbox({ path: `${BASE}${path}`, method: method as MutatingMethod, headers, body: init?.body as string | undefined });
    throw new Error('Offline — queued for sync');
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return (await res.text()) as T;
  }
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Request failed: ${path}`);
  }
  return json.data as T;
}

export interface SessionInfo {
  role: string;
  authMode: 'dev' | 'static';
  collectorMode: string;
  bcAdapter?: string;
  tenantId: string;
}

export interface QueueCard {
  id: string;
  millCode: string;
  status: string;
  workOrderNo: string;
  bcBatchNumber: string;
  customerCode: string;
  gradeCode: string;
  sizeKey: string;
  size: Record<string, unknown>;
  qtyPieces: number | null;
  runId: string | null;
}

export interface Run {
  id: string;
  runNo: string;
  millCode: string;
  workOrderNo: string | null;
  bcBatchNumber: string | null;
  customerCode: string | null;
  gradeCode: string | null;
  size: Record<string, unknown>;
  sizeKey: string;
  setupId?: string | null;
  runState: string;
  firstOffStatus: string;
  rawMaterialMt: number;
  totalPrimeMt: number;
  totalPq2Mt: number;
  totalCqMt: number;
  totalOpenMt: number;
  totalScrapMt: number;
  yieldPct: number | null;
  status: string;
  holdStatus?: string;
  remarks?: string | null;
  timeFrom?: string | null;
  grossRuntimeS?: number | null;
  netRuntimeS?: number | null;
  tooling: Record<string, unknown> | null;
  band: {
    powerKwMin: number;
    powerKwMax: number;
    speedMinMpm: number;
    speedMaxMpm: number;
  } | null;
}

export interface LiveData {
  runState: string;
  firstOffStatus: string;
  speedMpm: number;
  powerKw: number;
  currentAmp: number;
  pieceCount: number;
  inBand: boolean;
  outOfBand: boolean;
  outOfBandSince: string | null;
  band: Run['band'];
  canCountAsGood: boolean;
  lineRunning: boolean;
}

export interface StoppageCode {
  code: string;
  label: string;
  category: string;
  is_planned: boolean;
}

export interface YieldResult {
  status: 'ok' | 'warn';
  message: string;
  deltaMt: number;
  deltaPct: number | null;
  tolerancePct: number;
  rawMaterialMt: number;
  acceptedMt: number;
  scrapMt: number;
}

export interface ExceptionRow {
  id: string;
  kind: string;
  is_open: boolean;
  power_kw?: string;
  speed_mpm?: string;
  opened_at: string;
  detail?: unknown;
}

export const tubemillApi = {
  getSession: () => request<SessionInfo>('/tubemill/session'),
  getQueue: (mill = 'A-59') => request<QueueCard[]>(`/tubemill/queue?mill=${mill}`),
  listRuns: (mill = 'A-59') => request<Run[]>(`/tubemill/runs?mill=${mill}`),
  getLiveStatus: (mill = 'A-59') => request<Record<string, unknown>>(`/tubemill/live-status?mill=${mill}`),
  openRun: (queueCardId: string, millCode = 'A-59') =>
    request<Run>('/tubemill/runs', {
      method: 'POST',
      body: JSON.stringify({ queueCardId, millCode, setupType: 'INITIAL' }),
    }),
  getRun: (id: string) => request<Run>(`/tubemill/runs/${id}`),
  saveSetup: (runId: string, body: Record<string, unknown>) =>
    request<Run>(`/tubemill/runs/${runId}/setup`, { method: 'POST', body: JSON.stringify(body) }),
  firstOff: (runId: string, result: 'PASS' | 'FAIL', approvedBy: string) =>
    request<Run>(`/tubemill/runs/${runId}/first-off`, {
      method: 'POST',
      body: JSON.stringify({ result, approvedBy }),
    }),
  addCoil: (runId: string, body: Record<string, unknown>) =>
    request<unknown>(`/tubemill/runs/${runId}/coils`, { method: 'POST', body: JSON.stringify(body) }),
  addBundle: (runId: string, body: Record<string, unknown>) =>
    request<unknown>(`/tubemill/runs/${runId}/bundles`, { method: 'POST', body: JSON.stringify(body) }),
  getLive: (runId: string) => request<LiveData>(`/tubemill/runs/${runId}/live`),
  getExceptions: (runId: string) => request<ExceptionRow[]>(`/tubemill/runs/${runId}/exceptions`),
  getCoils: (runId: string) => request<Record<string, unknown>[]>(`/tubemill/runs/${runId}/coils`),
  getBundles: (runId: string) => request<Record<string, unknown>[]>(`/tubemill/runs/${runId}/bundles`),
  getStoppages: (runId: string) => request<Record<string, unknown>[]>(`/tubemill/runs/${runId}/stoppages`),
  getStoppageCodes: () => request<StoppageCode[]>('/tubemill/stoppage-codes'),
  getDefectCodes: () => request<{ code: string; label: string; category: string }[]>('/tubemill/defect-codes'),
  codeStoppage: (id: string, stoppageCode: string, reason?: string) =>
    request<unknown>(`/tubemill/stoppages/${id}/code`, {
      method: 'POST',
      body: JSON.stringify({ stoppageCode, reason }),
    }),
  saveParamManual: (runId: string, body: Record<string, unknown>) =>
    request<unknown>(`/tubemill/runs/${runId}/param-manual`, { method: 'POST', body: JSON.stringify(body) }),
  holdRun: (runId: string, remark?: string) =>
    request<Run>(`/tubemill/runs/${runId}/hold`, { method: 'POST', body: JSON.stringify({ remark }) }),
  resumeRun: (runId: string, remark?: string) =>
    request<Run>(`/tubemill/runs/${runId}/resume`, { method: 'POST', body: JSON.stringify({ remark }) }),
  addRemark: (runId: string, remark: string) =>
    request<Run>(`/tubemill/runs/${runId}/remark`, { method: 'POST', body: JSON.stringify({ remark }) }),
  startRun: (runId: string) => request<Run>(`/tubemill/runs/${runId}/start`, { method: 'POST' }),
  endRun: (runId: string, remark: string) =>
    request<Run>(`/tubemill/runs/${runId}/end`, {
      method: 'POST',
      body: JSON.stringify({ remark }),
    }),
  rollChange: (runId: string) => request<Run>(`/tubemill/runs/${runId}/roll-change`, { method: 'POST' }),
  manualStop: (runId: string, body?: Record<string, unknown>) =>
    request<Run>(`/tubemill/runs/${runId}/manual-stop`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  addDefect: (runId: string, body: Record<string, unknown>) =>
    request<unknown>(`/tubemill/runs/${runId}/defects`, { method: 'POST', body: JSON.stringify(body) }),
  getDefects: (runId: string) => request<Record<string, unknown>[]>(`/tubemill/runs/${runId}/defects`),
  addArcWeld: (runId: string, body: Record<string, unknown>) =>
    request<unknown>(`/tubemill/runs/${runId}/arcweld`, { method: 'POST', body: JSON.stringify(body) }),
  getArcWelds: (runId: string) => request<Record<string, unknown>[]>(`/tubemill/runs/${runId}/arcweld`),
  addEdgeMill: (runId: string, body: Record<string, unknown>) =>
    request<unknown>(`/tubemill/runs/${runId}/edgemill`, { method: 'POST', body: JSON.stringify(body) }),
  getEdgeMills: (runId: string) => request<Record<string, unknown>[]>(`/tubemill/runs/${runId}/edgemill`),
  submitRun: (runId: string) => request<Run>(`/tubemill/runs/${runId}/submit`, { method: 'POST' }),
  approveRun: (runId: string) => request<Run>(`/tubemill/runs/${runId}/approve`, { method: 'POST' }),
  lockRun: (runId: string) => request<Run>(`/tubemill/runs/${runId}/lock`, { method: 'POST' }),
  getYield: (runId: string) => request<YieldResult>(`/tubemill/runs/${runId}/yield`),
  exportRun: (runId: string, format: 'dpr' | 'shift-summary' = 'dpr') =>
    request<unknown>(`/tubemill/runs/${runId}/export?format=${format}`),
  exportCsv: async (runId: string) => {
    const headers: Record<string, string> = {};
    if (devRoleOverride) headers['x-app-role'] = devRoleOverride;
    const res = await fetch(`${BASE}/tubemill/runs/${runId}/export?format=csv`, { headers });
    if (!res.ok) throw new Error('CSV export failed');
    return res.text();
  },
  getConsumables: () => request<Record<string, unknown>[]>('/tubemill/consumables'),
  inspectConsumable: (code: string, visualInspection: string, action: string, runId?: string) =>
    request<unknown>(`/tubemill/consumables/${code}/inspect`, {
      method: 'POST',
      body: JSON.stringify({ visualInspection, action, runId }),
    }),
  syncPlan: () => request<{ upserted: number }>('/tubemill/erp/sync-plan', { method: 'POST', body: '{}' }),
  writeback: (runId: string) => request<unknown>(`/tubemill/runs/${runId}/writeback`, { method: 'POST' }),
  openShift: (shiftCode = 'A') =>
    request<unknown>('/tubemill/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ millCode: 'A-59', shiftCode }),
    }),
  listShifts: () => request<Record<string, unknown>[]>('/tubemill/shifts?mill=A-59'),
  shiftBoundary: (nextShiftCode = 'B') =>
    request<unknown>('/tubemill/shifts/boundary', {
      method: 'POST',
      body: JSON.stringify({ millCode: 'A-59', nextShiftCode }),
    }),
  getParamChart: () => request<Record<string, unknown>[]>('/tubemill/param-chart'),
  patchParamChart: (id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/tubemill/param-chart/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
