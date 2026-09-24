import { apiRequest } from '../api/http';

/**
 * Client for /api/machines/handover/*
 */
export const machineHandoverService = {
  getOverview: () => apiRequest('/machines/handover/overview'),

  listPending: () => apiRequest('/machines/handover/pending'),

  getPending: (machineCode) =>
    apiRequest(`/machines/handover/${encodeURIComponent(machineCode)}/pending`),

  getDraft: (machineCode) =>
    apiRequest(`/machines/handover/${encodeURIComponent(machineCode)}/draft`),

  getPreview: (machineCode) =>
    apiRequest(`/machines/handover/${encodeURIComponent(machineCode)}/preview`),

  ensureSession: (machineCode, body = {}) =>
    apiRequest(`/machines/handover/${encodeURIComponent(machineCode)}/session`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  saveDraft: (machineCode, payload) =>
    apiRequest(`/machines/handover/${encodeURIComponent(machineCode)}/draft`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitOutgoing: (machineCode, payload) =>
    apiRequest(`/machines/handover/${encodeURIComponent(machineCode)}/outgoing`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  accept: (handoverId) =>
    apiRequest(`/machines/handover/accept/${encodeURIComponent(handoverId)}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  requestClarification: (handoverId, notes) =>
    apiRequest(`/machines/handover/clarification/${encodeURIComponent(handoverId)}`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
};
