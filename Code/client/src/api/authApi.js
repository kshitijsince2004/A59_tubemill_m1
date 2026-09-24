import { apiRequest } from './http';

export const authApi = {
  me: () => apiRequest('/auth/me'),
  badgePin: (empCode, pin) =>
    apiRequest('/auth/badge-pin', {
      method: 'POST',
      body: JSON.stringify({ empCode, pin }),
    }),
  verifyPin: (pin) =>
    apiRequest('/auth/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  /** KEEP name supervisorOverride — powers field override / kiosk exit. */
  supervisorOverride: (empCode, pin, scope = {}) =>
    apiRequest('/auth/supervisor-override', {
      method: 'POST',
      body: JSON.stringify({
        empCode,
        pin,
        action: scope.action ?? 'APPROVE',
        resourceId: scope.resourceId ?? null,
      }),
    }),
};
