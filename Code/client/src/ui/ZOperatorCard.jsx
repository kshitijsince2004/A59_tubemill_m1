import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";








export default function ZOperatorCard({ title, headerActions, className = '', children }) {
  return (/*#__PURE__*/
    _jsxs("section", { className: `panel z-operator-card ${className}`.trim(), children: [
      (title || headerActions) && /*#__PURE__*/
      _jsxs("header", { className: "z-operator-card__header", children: [
        title ? /*#__PURE__*/_jsx("h2", { children: title }) : /*#__PURE__*/_jsx("span", {}),
        headerActions] }
      ), /*#__PURE__*/

      _jsx("div", { className: "z-operator-card__body", children: children })] }
    ));

}