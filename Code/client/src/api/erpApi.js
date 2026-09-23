import { apiRequest } from './http';


























export const erpApi = {
  health: () => apiRequest('/erp/health'),
  watermarks: () => apiRequest('/erp/watermarks'),
  orders: (status = 'Released') =>
  apiRequest(`/erp/orders?status=${encodeURIComponent(status)}`),
  sync: (entities) =>
  apiRequest('/erp/sync', {
    method: 'POST',
    body: JSON.stringify(entities ? { entities } : {})
  }),
  flushWriteback: (limit = 50) =>
  apiRequest('/erp/writeback/flush', {
    method: 'POST',
    body: JSON.stringify({ limit })
  })
};