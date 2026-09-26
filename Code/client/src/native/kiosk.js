/**
 * Device-owner lock-task kiosk helpers.
 * Native methods are provided by the Android MainActivity bridge when present.
 */
export async function startKioskIfDeviceOwner() {
  try {
    if (window.ZedralKioskNative?.startLockTask) {
      return Boolean(window.ZedralKioskNative.startLockTask());
    }
    if (window.ZedralKiosk?.startLockTask) {
      await window.ZedralKiosk.startLockTask();
      return true;
    }
  } catch {
    /* bench: screen pinning only */
  }
  return false;
}

export async function stopKiosk() {
  try {
    if (window.ZedralKioskNative?.stopLockTask) {
      return Boolean(window.ZedralKioskNative.stopLockTask());
    }
    if (window.ZedralKiosk?.stopLockTask) {
      await window.ZedralKiosk.stopLockTask();
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Hidden maintenance exit: five taps on logo then supervisor PIN verified in web layer.
 */
export function createLogoExitGesture({ onArmed }) {
  let taps = 0;
  let timer = null;
  return () => {
    taps += 1;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      taps = 0;
    }, 2000);
    if (taps >= 5) {
      taps = 0;
      onArmed?.();
    }
  };
}
