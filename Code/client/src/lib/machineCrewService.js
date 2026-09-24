import { apiRequest } from '../api/http';

/**
 * Offline-aware Machine Head crew roster client.
 * Mutating calls go through apiRequest which queues to IndexedDB outbox when offline.
 * Queue grouping key convention: crew:<machineCode>
 */

function crewKey(machineCode) {
  return `crew:${machineCode || 'unknown'}`;
}

export async function listMachineCrew(machineCode) {
  const q = machineCode
    ? `?machineCode=${encodeURIComponent(machineCode)}`
    : '';
  const data = await apiRequest(`/machine-head/crew${q}`);
  return data?.items ?? data ?? [];
}

export async function createMachineCrew({ machineCode, personName, roleLabel, shiftCode }) {
  return apiRequest('/machine-head/crew', {
    method: 'POST',
    headers: { 'X-Outbox-Key': crewKey(machineCode) },
    body: JSON.stringify({
      machineCode,
      personName,
      memberName: personName,
      roleLabel,
      shiftCode,
    }),
  });
}

export async function updateMachineCrew(crewId, { machineCode, personName, roleLabel, shiftCode }) {
  return apiRequest(`/machine-head/crew/${crewId}`, {
    method: 'PUT',
    headers: { 'X-Outbox-Key': crewKey(machineCode) },
    body: JSON.stringify({
      personName,
      memberName: personName,
      roleLabel,
      shiftCode,
    }),
  });
}

export async function deleteMachineCrew(crewId, machineCode) {
  const q = machineCode ? `?machineCode=${encodeURIComponent(machineCode)}` : '';
  return apiRequest(`/machine-head/crew/${crewId}${q}`, {
    method: 'DELETE',
    headers: { 'X-Outbox-Key': crewKey(machineCode) },
  });
}

export async function ensureMachineSession(machineCode, body = {}) {
  return apiRequest(`/machines/${encodeURIComponent(machineCode)}/session`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function attachCrewToSession(sessionId, crewIds) {
  return apiRequest('/crew/attach', {
    method: 'POST',
    body: JSON.stringify({ sessionId, crewIds }),
  });
}

export async function listSessionCrew({ sessionId, shiftLogId } = {}) {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  if (shiftLogId) params.set('shiftLogId', shiftLogId);
  const data = await apiRequest(`/crew?${params.toString()}`);
  return data?.items ?? data ?? [];
}
