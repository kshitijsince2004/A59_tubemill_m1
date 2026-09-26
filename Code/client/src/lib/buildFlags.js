/**
 * Compile-time build flags. `__OPERATOR_BUILD__` is defined only by vite.operator.config.js.
 */
export function isOperatorBuild() {
  try {
    return typeof __OPERATOR_BUILD__ !== 'undefined' && Boolean(__OPERATOR_BUILD__);
  } catch {
    return false;
  }
}
