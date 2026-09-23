
import { ZBadge } from '../ui';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";





export default function LiveMachineStrip({ live }) {
  if (!live) return /*#__PURE__*/_jsx("div", { className: "panel", children: "Waiting for live data\u2026" });

  return (/*#__PURE__*/
    _jsxs("div", { className: "panel", children: [/*#__PURE__*/
      _jsx("h2", { children: "Live Machine" }),
      live.outOfBand && /*#__PURE__*/
      _jsxs("div", { className: "exception-banner", style: { marginBottom: '0.75rem' }, children: ["OUT OF BAND \u2014 weld power ", /*#__PURE__*/
        _jsx("span", { className: "font-mono", children: live.powerKw }), " kW outside TM-02 window",
        live.outOfBandSince ? ` since ${new Date(live.outOfBandSince).toLocaleTimeString()}` : ''] }
      ), /*#__PURE__*/

      _jsxs("div", { className: "live-strip", children: [/*#__PURE__*/
        _jsxs("div", { className: "metric", children: [/*#__PURE__*/
          _jsx("div", { className: "value", children: live.speedMpm }), /*#__PURE__*/
          _jsx("div", { className: "label", children: "Speed (mpm)" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "metric", children: [/*#__PURE__*/
          _jsx("div", { className: "value", children: live.powerKw }), /*#__PURE__*/
          _jsx("div", { className: "label", children: "Weld Power (kW)" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "metric", children: [/*#__PURE__*/
          _jsx("div", { className: "value", children: live.currentAmp }), /*#__PURE__*/
          _jsx("div", { className: "label", children: "Current (A)" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "metric", children: [/*#__PURE__*/
          _jsx("div", { className: "value", children: live.pieceCount }), /*#__PURE__*/
          _jsx("div", { className: "label", children: "Piece Count" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "metric", children: [/*#__PURE__*/
          _jsx("div", { className: "value", children: /*#__PURE__*/
            _jsx(ZBadge, { tone: live.inBand ? 'success' : 'danger', children: live.inBand ? 'IN BAND' : 'OUT' }) }
          ), /*#__PURE__*/
          _jsx("div", { className: "label", children: "Band Status" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "metric", children: [/*#__PURE__*/
          _jsx("div", { className: "value", style: { fontSize: '1rem' }, children:
            live.runState.replace(/_/g, ' ') }
          ), /*#__PURE__*/
          _jsx("div", { className: "label", children: "Mill State" })] }
        )] }
      ),
      live.band && /*#__PURE__*/
      _jsxs("p", { className: "font-mono", style: { marginTop: '0.75rem', color: 'var(--color-muted-foreground)', fontSize: '0.85rem' }, children: ["TM-02 band: ",
        live.band.powerKwMin, "\u2013", live.band.powerKwMax, " kW \xB7 ", live.band.speedMinMpm, "\u2013",
        live.band.speedMaxMpm, " mpm"] }
      ), /*#__PURE__*/

      _jsxs("div", { className: "btn-row", style: { marginTop: '0.75rem' }, children: [/*#__PURE__*/
        _jsx(ZBadge, { tone: live.lineRunning ? 'success' : 'warn', children:
          live.lineRunning ? 'LINE RUNNING' : 'LINE STOPPED' }
        ), /*#__PURE__*/
        _jsx(ZBadge, { tone: live.canCountAsGood ? 'success' : 'warn', children:
          live.canCountAsGood ? 'COUNTS GOOD' : 'COUNTS SCRAP' }
        )] }
      )] }
    ));

}