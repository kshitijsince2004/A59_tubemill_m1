import { apiRequest } from './http';

export const masterDataApi = {
  list: (entityType) => apiRequest(`/master-data/${encodeURIComponent(entityType)}`),
  create: (entityType, body) =>
    apiRequest(`/master-data/${encodeURIComponent(entityType)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (entityType, id, body) =>
    apiRequest(`/master-data/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  remove: (entityType, id) =>
    apiRequest(`/master-data/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
