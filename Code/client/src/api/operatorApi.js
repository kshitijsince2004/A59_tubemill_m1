import { apiRequest } from './http';

export const operatorApi = {
  context: () => apiRequest('/operator/context'),
  masters: (since) =>
    apiRequest(since ? `/operator/masters?since=${encodeURIComponent(since)}` : '/operator/masters'),
  work: (line) =>
    apiRequest(line ? `/operator/work?line=${encodeURIComponent(line)}` : '/operator/work'),
  minVersion: () => apiRequest('/operator/min-version'),
};

export const deviceApi = {
  register: (body) =>
    apiRequest('/device/register', { method: 'POST', body: JSON.stringify(body) }),
  me: (deviceId) =>
    apiRequest(
      deviceId ? `/device/me?deviceId=${encodeURIComponent(deviceId)}` : '/device/me'
    ),
};
