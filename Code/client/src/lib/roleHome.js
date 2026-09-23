import { hasProcessAccess, primaryRole } from './authStore';

/** Mirrors @a59/shared ROLE_RANK (CJS re-export is opaque to Vite/Rollup). */
const ROLE_RANK = {
  OPERATOR: 0,
  MACHINE_HEAD: 1,
  PLANT_HEAD: 2,
  ADMIN: 3,
};

export const PROCESS_META = [
  { id: 'TM', label: 'Tube Mill', machineCode: 'A-59', path: '/tm' },
  { id: 'FUR', label: 'Furnace', machineCode: 'RHF-03', path: '/fur' },
  { id: 'STP', label: 'STP', machineCode: 'STP-LINE', path: '/stp' },
  { id: 'DRW', label: 'Draw Bench', machineCode: 'DRW-01', path: '/drw' },
  { id: 'SWG', label: 'Swaging', machineCode: 'SWG-01', path: '/swg' },
];

export function processPath(processId) {
  return PROCESS_META.find((p) => p.id === processId)?.path ?? '/tm';
}

export function allowedProcesses(user) {
  return PROCESS_META.filter((p) => hasProcessAccess(user, p.id, 'READ'));
}

export function firstProcessPath(user) {
  const list = allowedProcesses(user);
  if (!list.length) return '/tm';
  const saved = localStorage.getItem('a59-process');
  const hit = list.find((p) => p.id === saved);
  return (hit ?? list[0]).path;
}

/**
 * Post-login / role home path.
 * MACHINE_HEAD → MH dashboard; ADMIN → admin; PLANT_HEAD → Plant Command Center;
 * OPERATOR → first allowed process floor.
 */
export function roleHomePath(user) {
  if (!user) return '/login';
  const role = primaryRole(user);
  if (role === 'ADMIN') return '/admin';
  if (role === 'PLANT_HEAD') return '/plant';
  if (role === 'MACHINE_HEAD') return '/machine-head-dashboard';
  return firstProcessPath(user);
}

export function roleAtLeast(user, minRole) {
  if (!user) return false;
  if (user.roles?.includes('ADMIN') || user.primaryRole === 'ADMIN') return true;
  const rank = ROLE_RANK[primaryRole(user)] ?? 0;
  return rank >= (ROLE_RANK[minRole] ?? 0);
}
