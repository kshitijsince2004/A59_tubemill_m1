/**
 * Capacitor Preferences-backed token storage for native; sessionStorage for web.
 */
let Preferences = null;
let native = false;

async function ensureNative() {
  if (Preferences !== null) return native;
  try {
    const core = await import('@capacitor/core');
    native = Boolean(core.Capacitor?.isNativePlatform?.());
    if (native) {
      const mod = await import('@capacitor/preferences');
      Preferences = mod.Preferences;
    } else {
      Preferences = false;
    }
  } catch {
    Preferences = false;
    native = false;
  }
  return native;
}

export async function secureGet(key) {
  if (await ensureNative()) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  }
  return sessionStorage.getItem(key) || localStorage.getItem(key);
}

export async function secureSet(key, value) {
  if (await ensureNative()) {
    if (value == null) await Preferences.remove({ key });
    else await Preferences.set({ key, value: String(value) });
    return;
  }
  if (value == null) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, String(value));
    localStorage.removeItem(key);
  }
}

export async function secureRemove(key) {
  await secureSet(key, null);
}

export function isNativePlatform() {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
