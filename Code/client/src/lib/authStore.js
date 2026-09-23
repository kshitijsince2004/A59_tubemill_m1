

const TOKEN_KEY = 'a59-st-access-token';
const USER_KEY = 'a59-auth-user';
const LOCK_KEY = 'a59-screen-locked';


const listeners = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  notify();
}

export function getStoredUser() {
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) {
    const raw = JSON.stringify(user);
    sessionStorage.setItem(USER_KEY, raw);
    localStorage.setItem(USER_KEY, raw);
  } else {
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_KEY);
  }
  notify();
}

export function isScreenLocked() {
  return localStorage.getItem(LOCK_KEY) === '1';
}

export function setScreenLocked(locked) {
  if (locked) localStorage.setItem(LOCK_KEY, '1');else
  localStorage.removeItem(LOCK_KEY);
  notify();
}

export function clearAuth() {
  setAccessToken(null);
  setStoredUser(null);
  setScreenLocked(false);
  localStorage.removeItem('a59-unlocked');
  localStorage.removeItem('a59-role');
  localStorage.removeItem('a59-badge');
}

export function primaryRole(user) {
  return user?.primaryRole ?? 'OPERATOR';
}

export function hasProcessAccess(
user,
processCode,
minLevel = 'READ')
{
  if (!user) return false;
  if (user.roles.includes('ADMIN') || user.roles.includes('PLANT_HEAD')) return true;
  const rank = { READ: 1, WRITE: 2, APPROVE: 3 };
  const grant = user.processAccess.find((g) => g.processCode === processCode);
  if (!grant) return false;
  return rank[grant.level] >= rank[minLevel];
}