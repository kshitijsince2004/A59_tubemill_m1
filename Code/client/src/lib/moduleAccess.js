import { hasProcessAccess } from './authStore';

/** Tube Mill workstation modules — independent, not a sequential workflow. */
export const TM_MODULES = [
  { id: 'orders', label: 'Orders', icon: '▣', processCode: 'TM', minLevel: 'READ' },
  { id: 'capture', label: 'Capture', icon: '◎', processCode: 'TM', minLevel: 'WRITE' },
  { id: 'parameters', label: 'Parameters', icon: '▦', processCode: 'TM', minLevel: 'READ' },
  { id: 'history', label: 'History', icon: '▤', processCode: 'TM', minLevel: 'READ' },
];

/**
 * Module visibility from existing RBAC (processAccess + roles).
 * Optional future: user.moduleAccess[{ moduleId, level }] overrides.
 */
export function listAllowedTmModules(user) {
  if (!user) return [];
  const explicit = Array.isArray(user.moduleAccess) ? user.moduleAccess : null;

  return TM_MODULES.filter((mod) => {
    if (explicit) {
      const grant = explicit.find((g) => g.moduleId === mod.id || g.module_id === mod.id);
      if (grant) {
        const rank = { READ: 1, WRITE: 2, APPROVE: 3 };
        const level = String(grant.level || 'READ').toUpperCase();
        return (rank[level] ?? 0) >= (rank[mod.minLevel] ?? 1);
      }
      // If moduleAccess is present but this module is omitted, deny
      return false;
    }
    return hasProcessAccess(user, mod.processCode, mod.minLevel);
  });
}

export function canAccessTmModule(user, moduleId) {
  return listAllowedTmModules(user).some((m) => m.id === moduleId);
}

export function defaultTmModule(user) {
  const allowed = listAllowedTmModules(user);
  return allowed[0]?.id ?? 'orders';
}

const LEGACY_NAV = { queue: 'orders' };
const EXTRA_NAV = new Set(['setup', 'admin']);

export function normalizeTmModule(id) {
  if (!id) return null;
  const mapped = LEGACY_NAV[id] ?? id;
  if (EXTRA_NAV.has(mapped)) return mapped;
  return TM_MODULES.some((m) => m.id === mapped) ? mapped : null;
}

export function readTmModuleFromHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#\/?/, '');
  const part = hash.split(/[/?]/)[0];
  return normalizeTmModule(part);
}

export function writeTmModuleHash(moduleId) {
  if (typeof window === 'undefined') return;
  const next = `#/${moduleId}`;
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', next);
  }
}
