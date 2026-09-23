import { apiRequest } from '../api/http';

export const adminApi = {
  listUsers: () => apiRequest('/users'),
  createUser: (body) =>
    apiRequest('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) =>
    apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setProcessAccess: (id, grants) =>
    apiRequest(`/users/${id}/process-access`, {
      method: 'PUT',
      body: JSON.stringify({ grants }),
    }),
  setMachineAccess: (id, grants) =>
    apiRequest(`/users/${id}/machine-access`, {
      method: 'PUT',
      body: JSON.stringify({ grants }),
    }),
  listMachines: () => apiRequest('/machines/master'),
  createMachine: (body) =>
    apiRequest('/machines/master', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMachine: (code, body) =>
    apiRequest(`/machines/master/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
