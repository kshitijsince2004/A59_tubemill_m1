import { apiCsv, apiRequest } from './http';






export const furnaceApi = {
  listLots: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/furnace/lots${qs ? `?${qs}` : ''}`);
  },
  getLot: (id) => apiRequest(`/furnace/lots/${id}`),
  createLot: (body) =>
  apiRequest('/furnace/lots', { method: 'POST', body: JSON.stringify(body) }),
  updateLot: (id, body) =>
  apiRequest(`/furnace/lots/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  submit: (id) => apiRequest(`/furnace/lots/${id}/submit`, { method: 'POST' }),
  start: (id) => apiRequest(`/furnace/lots/${id}/start`, { method: 'POST' }),
  end: (id) => apiRequest(`/furnace/lots/${id}/end`, { method: 'POST' }),
  approve: (id) => apiRequest(`/furnace/lots/${id}/approve`, { method: 'POST' }),
  hold: (id) => apiRequest(`/furnace/lots/${id}/hold`, { method: 'POST' }),
  clearExcursion: (id, body) =>
    apiRequest(`/furnace/lots/${id}/clear-excursion`, {
      method: 'POST',
      body: JSON.stringify(body ?? { disposition: 'ACCEPT_WITH_NOTE' }),
    }),
  addGasLog: (id, body) =>
  apiRequest(`/furnace/lots/${id}/gas-log`, { method: 'POST', body: JSON.stringify(body) }),
  machines: () => apiRequest('/furnace/machines'),
  board: () => apiRequest('/furnace/board'),
  assign: (furnaceCode, body) =>
  apiRequest(`/furnace/board/${encodeURIComponent(furnaceCode)}/assign`, {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  openStoppages: () => apiRequest('/furnace/stoppages/open'),
  stoppageHistory: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/furnace/stoppages${qs ? `?${qs}` : ''}`);
  },
  gasLogs: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/furnace/gas-logs${qs ? `?${qs}` : ''}`);
  },
  getConsumption: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/furnace/consumption${qs ? `?${qs}` : ''}`);
  },
  saveConsumption: (body) =>
    apiRequest('/furnace/consumption', { method: 'PUT', body: JSON.stringify(body) }),
  recipe: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/furnace/recipes${qs ? `?${qs}` : ''}`);
  },
  exportJson: (id) => apiRequest(`/furnace/lots/${id}/export`),
  exportCsv: (id) => apiCsv(`/furnace/lots/${id}/export?format=csv`)
};

export const stpApi = {
  listOrders: (status = 'Released') =>
    apiRequest(`/stp/orders?status=${encodeURIComponent(status)}`),
  liveStatus: () => apiRequest('/stp/live-status'),
  listLots: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/stp/lots${qs ? `?${qs}` : ''}`);
  },
  getLot: (id) => apiRequest(`/stp/lots/${id}`),
  assign: (body) =>
    apiRequest('/stp/lots/assign', { method: 'POST', body: JSON.stringify(body) }),
  createLot: (body) =>
    apiRequest('/stp/lots', { method: 'POST', body: JSON.stringify(body) }),
  updateLot: (id, body) =>
    apiRequest(`/stp/lots/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  start: (id) => apiRequest(`/stp/lots/${id}/start`, { method: 'POST' }),
  end: (id) => apiRequest(`/stp/lots/${id}/end`, { method: 'POST' }),
  listStages: (id) => apiRequest(`/stp/lots/${id}/stages`),
  ensureStages: (id) =>
    apiRequest(`/stp/lots/${id}/stages/ensure`, { method: 'POST', body: '{}' }),
  advanceStage: (id) =>
    apiRequest(`/stp/lots/${id}/stages/advance`, { method: 'POST', body: '{}' }),
  submit: (id) => apiRequest(`/stp/lots/${id}/submit`, { method: 'POST' }),
  approve: (id) => apiRequest(`/stp/lots/${id}/approve`, { method: 'POST' }),
  hold: (id) => apiRequest(`/stp/lots/${id}/hold`, { method: 'POST' }),
  bathSignOff: (id, body) =>
    apiRequest(`/stp/lots/${id}/bath-sign-off`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  addBathAnalysis: (id, body) =>
    id
      ? apiRequest(`/stp/lots/${id}/bath-analysis`, { method: 'POST', body: JSON.stringify(body) })
      : apiRequest('/stp/bath-analysis', { method: 'POST', body: JSON.stringify(body) }),
  addChemicalAddition: (id, body) =>
    id
      ? apiRequest(`/stp/lots/${id}/chemical-addition`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      : apiRequest('/stp/chemical-addition', { method: 'POST', body: JSON.stringify(body) }),
  addCoating: (id, body) =>
    apiRequest(`/stp/lots/${id}/coating`, { method: 'POST', body: JSON.stringify(body) }),
  listBathHistory: () => apiRequest('/stp/bath-history'),
  listBathSpecs: () => apiRequest('/stp/bath-specs'),
  addBathHistory: (body) =>
    apiRequest('/stp/bath-history', { method: 'POST', body: JSON.stringify(body) }),
  historyBathAnalysis: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/stp/history/bath-analysis${qs ? `?${qs}` : ''}`);
  },
  historyChemical: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/stp/history/chemical${qs ? `?${qs}` : ''}`);
  },
  historyStoppages: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/stp/history/stoppages${qs ? `?${qs}` : ''}`);
  },
  exportJson: (id) => apiRequest(`/stp/lots/${id}/export`),
  exportCsv: (id) => apiCsv(`/stp/lots/${id}/export?format=csv`)
};

export const drawBenchApi = {
  listLots: (q = {}) => {
    const qs = new URLSearchParams(q).toString();
    return apiRequest(`/drawbench/lots${qs ? `?${qs}` : ''}`);
  },
  getLot: (id) => apiRequest(`/drawbench/lots/${id}`),
  createLot: (body) =>
    apiRequest('/drawbench/lots', { method: 'POST', body: JSON.stringify(body) }),
  updateLot: (id, body) =>
    apiRequest(`/drawbench/lots/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  submit: (id) => apiRequest(`/drawbench/lots/${id}/submit`, { method: 'POST' }),
  approve: (id) => apiRequest(`/drawbench/lots/${id}/approve`, { method: 'POST' }),
  board: () => apiRequest('/drawbench/board'),
  assign: (benchCode, body) =>
    apiRequest(`/drawbench/board/${encodeURIComponent(benchCode)}/assign`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addShiftCheck: (id, body) =>
    apiRequest(`/drawbench/lots/${id}/shift-check`, { method: 'POST', body: JSON.stringify(body) }),
  addInspection: (id, body) =>
    apiRequest(`/drawbench/lots/${id}/inspection`, { method: 'POST', body: JSON.stringify(body) }),
  setInspectionDisposition: (lotId, inspId, disposition) =>
    apiRequest(`/drawbench/lots/${lotId}/inspection/${inspId}/disposition`, {
      method: 'POST',
      body: JSON.stringify({ disposition }),
    }),
  addToolingIssue: (id, body) =>
    apiRequest(`/drawbench/lots/${id}/tooling-issue`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addToolingUsage: (id, body) =>
    apiRequest(`/drawbench/lots/${id}/tooling-usage`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createSwage: (body) =>
    apiRequest('/drawbench/swage', { method: 'POST', body: JSON.stringify(body) }),
  machines: () => apiRequest('/drawbench/machines'),
  tooling: () => apiRequest('/drawbench/tooling'),
  suggestBench: (q = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(q).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return apiRequest(`/drawbench/benches/suggest${qs ? `?${qs}` : ''}`);
  },
  checkEligibility: (q = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(q).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return apiRequest(`/drawbench/benches/eligibility${qs ? `?${qs}` : ''}`);
  },
  paintColour: (grade) =>
    apiRequest(`/drawbench/paint-colour?grade=${encodeURIComponent(grade || '')}`),
  reports: () => apiRequest('/drawbench/reports'),
  exportJson: (id) => apiRequest(`/drawbench/lots/${id}/export`),
  exportCsv: (id) => apiCsv(`/drawbench/lots/${id}/export?format=csv`),
};