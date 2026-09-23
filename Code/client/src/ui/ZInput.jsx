import { jsx as _jsx } from "react/jsx-runtime";

export function ZInput(props) {
  return /*#__PURE__*/_jsx("input", { className: `z-input ${props.className ?? ''}`.trim(), ...props });
}

export function ZSelect(props) {
  return /*#__PURE__*/_jsx("select", { className: `z-select ${props.className ?? ''}`.trim(), ...props });
}

export function ZTextarea(props) {
  return /*#__PURE__*/_jsx("textarea", { className: `z-textarea ${props.className ?? ''}`.trim(), ...props });
}