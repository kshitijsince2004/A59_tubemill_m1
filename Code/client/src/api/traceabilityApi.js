import { apiRequest } from './http';

export const traceabilityApi = {
  /** @param {string} q */
  search: (q) => apiRequest(`/traceability?q=${encodeURIComponent(q)}`),

  /** @param {string} q */
  suggest: (q) => apiRequest(`/traceability/suggest?q=${encodeURIComponent(q)}`),
};
