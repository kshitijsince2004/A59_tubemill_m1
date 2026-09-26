import { secureGet, secureSet, isNativePlatform } from '../native/secureStorage';

const TOKEN_KEY = 'a59-st-access-token';
const REFRESH_KEY = 'a59-st-refresh-token';
const USER_KEY = 'a59-auth-user';
const LOCK_KEY = 'a59-screen-locked';
const OFFLINE_SESSION_KEY = 'a59-offline-session';

const listeners = new Set();
const memory = {
  access: null,
  refresh: null,
  user: null,
  offlineSession: null,
};

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Hydrate tokens from Capacitor Preferences on native before React mounts. */
export async function hydrateAuthFromSecureStorage() {
  if (!isNativePlatform() && typeof window !== 'undefined' && !window.Capacitor) {
    // Still try — secureGet falls back to sessionStorage
  }
  memory.access = await secureGet(TOKEN_KEY);
  memory.refresh = await secureGet(REFRESH_KEY);
  const userRaw = await secureGet(USER_KEY);
  if (userRaw) {
    try {
      memory.user = JSON.parse(userRaw);
    } catch {
      memory.user = null;
    }
  }
  const off = await secureGet(OFFLINE_SESSION_KEY);
  if (off) {
    try {
      memory.offlineSession = JSON.parse(off);
    } catch {
      memory.offlineSession = null;
    }
  }
  // Mirror into sessionStorage so sync code paths keep working
  if (memory.access) sessionStorage.setItem(TOKEN_KEY, memory.access);
  if (memory.refresh) sessionStorage.setItem(REFRESH_KEY, memory.refresh);
  if (memory.user) sessionStorage.setItem(USER_KEY, JSON.stringify(memory.user));
  notify();
}

export function getAccessToken() {
  return memory.access || sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token) {
  memory.access = token || null;
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
  localStorage.removeItem(TOKEN_KEY);
  void secureSet(TOKEN_KEY, token || null);
  notify();
}

export function getRefreshToken() {
  return memory.refresh || sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token) {
  memory.refresh = token || null;
  if (token) {
    sessionStorage.setItem(REFRESH_KEY, token);
  } else {
    sessionStorage.removeItem(REFRESH_KEY);
  }
  localStorage.removeItem(REFRESH_KEY);
  void secureSet(REFRESH_KEY, token || null);
}

export function getStoredUser() {
  if (memory.user) return memory.user;
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  memory.user = user || null;
  if (user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(USER_KEY);
  }
  localStorage.removeItem(USER_KEY);
  void secureSet(USER_KEY, user ? JSON.stringify(user) : null);
  notify();
}

export function getOfflineSession() {
  return memory.offlineSession;
}

export function setOfflineSession(session) {
  memory.offlineSession = session || null;
  void secureSet(OFFLINE_SESSION_KEY, session ? JSON.stringify(session) : null);
  if (session) sessionStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(OFFLINE_SESSION_KEY);
  notify();
}

export function isScreenLocked() {
  return localStorage.getItem(LOCK_KEY) === '1';
}

export function setScreenLocked(locked) {
  if (locked) localStorage.setItem(LOCK_KEY, '1');
  else localStorage.removeItem(LOCK_KEY);
  notify();
}

export function clearAuth() {
  setAccessToken(null);
  setRefreshToken(null);
  setStoredUser(null);
  setOfflineSession(null);
  setScreenLocked(false);
  localStorage.removeItem('a59-unlocked');
  localStorage.removeItem('a59-role');
  localStorage.removeItem('a59-badge');
}

export function primaryRole(user) {
  return user?.primaryRole ?? 'OPERATOR';
}

export function hasProcessAccess(user, processCode, minLevel = 'READ') {
  if (!user) return false;
  if (user.roles.includes('ADMIN') || user.roles.includes('PLANT_HEAD')) return true;
  const rank = { READ: 1, WRITE: 2, APPROVE: 3 };
  const grant = user.processAccess.find((g) => g.processCode === processCode);
  if (!grant) return false;
  return rank[grant.level] >= rank[minLevel];
}
