import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";











export default function ZFilterPills({ pills, value, onChange }) {
  return (/*#__PURE__*/
    _jsx("div", { className: "filter-pills", role: "tablist", "aria-label": "Queue filters", children:
      pills.map((p) => /*#__PURE__*/
      _jsxs("button", {

        type: "button",
        role: "tab",
        "aria-selected": value === p.id,
        className: `filter-pill ${value === p.id ? 'active' : ''}`,
        onClick: () => onChange(p.id), children: [

        p.label,
        typeof p.count === 'number' ? ` (${p.count})` : ''] }, p.id
      )
      ) }
    ));

}