/**
 * Native bootstrap for the operator APK (Capacitor).
 * Safe no-op in browser / when plugins are absent.
 */
export async function bootstrapNative() {
  try {
    const core = await import('@capacitor/core').catch(() => null);
    if (!core?.Capacitor?.isNativePlatform?.()) return { native: false };

    try {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await KeepAwake.keepAwake();
    } catch {
      /* optional */
    }

    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    } catch {
      /* optional */
    }

    try {
      const { openLocalDb } = await import('../offline/db');
      await openLocalDb();
    } catch {
      /* DB opens lazily in P5 */
    }

    try {
      const { startSyncEngine } = await import('../offline/syncEngine');
      startSyncEngine();
    } catch {
      /* sync engine optional until P5 */
    }

    return { native: true };
  } catch {
    return { native: false };
  }
}
