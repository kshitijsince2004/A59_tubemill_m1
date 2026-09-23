import { apiRequest } from './http';
import { getAccessToken } from '../lib/authStore';
import { getDevRoleOverride } from './http';












export const genealogyApi = {
  upstream: (process, workOrderNo) => {
    const qs = new URLSearchParams({ process });
    if (workOrderNo) qs.set('workOrderNo', workOrderNo);
    return apiRequest(`/genealogy/upstream?${qs}`);
  },
  attach: (body) =>




  apiRequest('/genealogy/attach', { method: 'POST', body: JSON.stringify(body) }),
  get: (id) => apiRequest(`/genealogy/${id}`)
};

export const stoppageApi = {
  codes: (process) =>
  apiRequest(
    `/stoppages/codes${process ? `?process=${encodeURIComponent(process)}` : ''}`
  ),
  list: (process, sourceId) =>
  apiRequest(
    `/stoppages?process=${encodeURIComponent(process)}&sourceId=${encodeURIComponent(sourceId)}`
  ),
  open: (body) =>
  apiRequest('/stoppages/open', { method: 'POST', body: JSON.stringify(body) }),
  close: (processCode, sourceId) =>
  apiRequest('/stoppages/close', {
    method: 'POST',
    body: JSON.stringify({ processCode, sourceId })
  })
};

export async function downloadXlsx(path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'st-auth-mode': 'header',
    'Idempotency-Key': crypto.randomUUID()
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;else
  {
    const role = getDevRoleOverride();
    if (role) headers['x-app-role'] = role;
  }
  const res = await fetch(`/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.errors?.[0]?.message ?? 'XLSX export failed');
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? 'export.xlsx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}