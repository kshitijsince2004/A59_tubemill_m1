
import { ZBadge, statusTone } from '../../ui';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";












/** Green capture header + scroll body for production console. */
export default function CaptureWorkspace({
  title = 'Production Console',
  runNo,
  machineCode,
  runState,
  hold,
  extraBadges,
  onClose,
  children
}) {
  return (/*#__PURE__*/
    _jsxs("div", { className: "capture-workspace", children: [/*#__PURE__*/
      _jsxs("div", { className: "process-header", children: [/*#__PURE__*/
        _jsxs("div", { className: "process-header__meta", children: [/*#__PURE__*/
          _jsx("h2", { className: "process-header__title", children: title }), /*#__PURE__*/
          _jsx("span", { className: "font-mono process-header__run", children: runNo }), /*#__PURE__*/
          _jsx(ZBadge, { tone: "idle", children: machineCode }), /*#__PURE__*/
          _jsx(ZBadge, { tone: statusTone(runState), children: String(runState ?? 'IDLE').replace(/_/g, ' ') }),
          hold ? /*#__PURE__*/_jsx(ZBadge, { tone: "pending", children: "HOLD" }) : null,
          extraBadges] }
        ),
        onClose ? /*#__PURE__*/
        _jsx("button", { type: "button", className: "process-header__close", onClick: onClose, "aria-label": "Close capture", children: "\u2715" }

        ) :
        null] }
      ), /*#__PURE__*/
      _jsx("div", { className: "capture-workspace__body", children: children })] }
    ));

}