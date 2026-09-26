/**
 * Injected into Capacitor WebView via MainActivity (see android-templates).
 * Until native project is generated, these are no-ops.
 */
(function () {
  if (typeof window === 'undefined') return;
  if (!window.ZedralKiosk) {
    window.ZedralKiosk = {
      startLockTask: async function () {
        console.info('[ZedralKiosk] startLockTask — native bridge not present');
        return false;
      },
      stopLockTask: async function () {
        console.info('[ZedralKiosk] stopLockTask — native bridge not present');
        return false;
      },
    };
  }
})();
