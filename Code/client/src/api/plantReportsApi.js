import { apiRequest, getDevRoleOverride, tryRefreshSession } from './http';
import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/authStore';

export const plantReportsApi = {
  dashboard: (windowDays = 7) =>
    apiRequest(`/reports/plant-head?windowDays=${encodeURIComponent(windowDays)}`),
  backlog: () => apiRequest('/reports/plant-head/backlog'),
  trend: (windowDays = 7) =>
    apiRequest(`/reports/plant-head/trend?windowDays=${encodeURIComponent(windowDays)}`),
  stages: (windowDays = 7) =>
    apiRequest(`/reports/plant-head/stages?windowDays=${encodeURIComponent(windowDays)}`),
  management: (period = '7d') =>
    apiRequest(`/reports/management?period=${encodeURIComponent(period)}`),
  drilldown: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') q.set(k, String(v));
    });
    return apiRequest(`/reports/drilldown?${q}`);
  },
  daily: (date) =>
    apiRequest(`/reports/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  coilTrace: (coilNo) =>
    apiRequest(`/reports/coil-traceability?coilNo=${encodeURIComponent(coilNo)}`),
  production: (windowDays = 7) =>
    apiRequest(`/reports/production?windowDays=${encodeURIComponent(windowDays)}`),
  defects: (windowDays = 14) =>
    apiRequest(`/reports/defects?windowDays=${encodeURIComponent(windowDays)}`),
  downtime: (windowDays = 14) =>
    apiRequest(`/reports/downtime?windowDays=${encodeURIComponent(windowDays)}`),
  orders: () => apiRequest('/reports/orders'),
  audit: (limit = 100) => apiRequest(`/audit?limit=${encodeURIComponent(limit)}`),
  exportReports: () => apiRequest('/plant/exports/reports'),
  exportHistory: () => apiRequest('/plant/exports/history'),
};

export async function downloadPlantBlob(url, body) {
  const buildHeaders = () => {
    const headers = {
      'Content-Type': 'application/json',
      'st-auth-mode': 'header',
    };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    else {
      const role = getDevRoleOverride() || localStorage.getItem('a59-role');
      if (role) headers['x-app-role'] = role;
    }
    return headers;
  };

  let res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  const access = res.headers.get('st-access-token');
  if (access) setAccessToken(access);
  const refreshHdr = res.headers.get('st-refresh-token');
  if (refreshHdr) setRefreshToken(refreshHdr);

  if (res.status === 401) {
    const ok = await tryRefreshSession();
    if (ok) {
      res = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
      });
    }
  }

  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.errors?.[0]?.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/.exec(cd);
  const filename = match?.[1] || 'export.bin';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return filename;
}
