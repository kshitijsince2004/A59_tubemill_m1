/**
 * Offline PIN verifier — never stores the PIN itself.
 * Uses Web Crypto PBKDF2 as a portable stand-in for scrypt when SubtleCrypto is available.
 */
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveVerifier(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(bits);
}

export async function buildPinVerifier(pin, userCode, deviceId) {
  const salt = `${userCode}:${deviceId || 'web'}`;
  return deriveVerifier(pin, salt);
}

export async function verifyPinOffline(pin, storedVerifier, userCode, deviceId) {
  if (!storedVerifier) return false;
  const next = await buildPinVerifier(pin, userCode, deviceId);
  if (next.length !== storedVerifier.length) return false;
  let ok = 0;
  for (let i = 0; i < next.length; i++) ok |= next.charCodeAt(i) ^ storedVerifier.charCodeAt(i);
  return ok === 0;
}

const OFFLINE_SESSION_MAX_MS = 14 * 60 * 60 * 1000; // ~one shift + margin
const AUTH_CACHE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

export function isAuthCacheFresh(cachedAt) {
  return Date.now() - Number(cachedAt || 0) < AUTH_CACHE_MAX_MS;
}

export function isOfflineSessionValid(startedAt) {
  return Date.now() - Number(startedAt || 0) < OFFLINE_SESSION_MAX_MS;
}
