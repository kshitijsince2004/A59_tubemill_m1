import { apiRequest } from './http';

export const validationRulesApi = {
  list: (processCode) =>
    apiRequest(
      processCode
        ? `/validation-rules?processCode=${encodeURIComponent(processCode)}`
        : '/validation-rules'
    ),
  version: () => apiRequest('/validation-rules/version'),
  upsert: (body) =>
    apiRequest('/validation-rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  remove: (ruleId) =>
    apiRequest(`/validation-rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    }),
};
