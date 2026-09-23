import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";










export default function ZBadge({ tone = 'idle', children, className = '', pulse }) {
  return (/*#__PURE__*/
    _jsxs("span", { className: `z-badge z-badge--${tone} ${pulse ? 'z-badge--pulse' : ''} ${className}`.trim(), children: [
      pulse && /*#__PURE__*/_jsx("span", { className: "z-badge__dot", "aria-hidden": true }),
      children] }
    ));

}

/** Map mill / queue status strings to badge tones per brand accent rules. */
export function statusTone(status) {
  const s = String(status ?? '').toUpperCase().replace(/\s+/g, '_');
  if (s === 'PENDING' || s === 'HOLD' || s === 'ON_HOLD' || s === 'HELD' || s === 'NOT_STARTED' || s === 'IDLE') return 'pending';
  if (s === 'RUNNING' || s === 'IN_BAND' || s === 'PASS' || s === 'SYNCED' || s === 'LOCKED' || s === 'APPROVED')
  return 'success';
  if (s === 'STOPPAGE' || s === 'STOPPED' || s === 'FIRST_OFF_PENDING' || s === 'SUBMITTED') return 'warn';
  if (s === 'SETUP' || s === 'PREPARING' || s === 'IN_PROGRESS' || s === 'COMPLETED' || s === 'COMPLETE' || s === 'RUN_COMPLETE') return 'info';
  if (s === 'FAIL' || s === 'SCRAP' || s === 'OUT' || s === 'OUT_OF_BAND') return 'danger';
  return 'idle';
}