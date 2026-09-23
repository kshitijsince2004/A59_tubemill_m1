import { useState } from 'react';

import { ZButton, ZBadge, ZInput, ZSelect } from '../ui';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

function isOpenFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const s = String(value).toLowerCase();
  return s === 't' || s === 'true' || s === '1' || s === 'yes';
}







export default function StoppagePanel({ stoppages, codes, onCode }) {
  const [selected, setSelected] = useState({});
  const [reasons, setReasons] = useState({});

  const open = stoppages.filter((s) => isOpenFlag(s.is_open));

  return (/*#__PURE__*/
    _jsxs("div", { className: "panel", id: "stoppage-panel", children: [/*#__PURE__*/
      _jsx("h2", { children: "Stoppages" }), /*#__PURE__*/
      _jsxs("p", { className: "eyebrow", style: { margin: '0 0 8px' }, children: [
        stoppages.length, " recorded \xB7 ", open.length, " open"] }
      ),
      stoppages.length === 0 && /*#__PURE__*/
      _jsx("p", { style: { color: 'var(--color-muted-foreground)' }, children: "No stoppages recorded yet." }),

      stoppages.length > 0 && /*#__PURE__*/
      _jsx("div", { className: "table-scroll", children: /*#__PURE__*/
        _jsxs("table", { className: "table data-table", children: [/*#__PURE__*/
          _jsx("thead", { children: /*#__PURE__*/
            _jsxs("tr", { children: [/*#__PURE__*/
              _jsx("th", { children: "From" }), /*#__PURE__*/
              _jsx("th", { children: "To" }), /*#__PURE__*/
              _jsx("th", { children: "Code" }), /*#__PURE__*/
              _jsx("th", { children: "Reason" }), /*#__PURE__*/
              _jsx("th", { children: "Status" }), /*#__PURE__*/
              _jsx("th", { children: "Action" })] }
            ) }
          ), /*#__PURE__*/
          _jsx("tbody", { children:
            stoppages.map((s) => {
              const id = String(s.id);
              const openRow = isOpenFlag(s.is_open);
              return (/*#__PURE__*/
                _jsxs("tr", { children: [/*#__PURE__*/
                  _jsx("td", { className: "mono", children:
                    s.from_time ? new Date(String(s.from_time)).toLocaleTimeString() : '—' }
                  ), /*#__PURE__*/
                  _jsx("td", { className: "mono", children:
                    s.to_time ? new Date(String(s.to_time)).toLocaleTimeString() : '—' }
                  ), /*#__PURE__*/
                  _jsx("td", { className: "mono", children: String(s.stoppage_code ?? '—') }), /*#__PURE__*/
                  _jsx("td", { children: String(s.reason ?? s.remark ?? '—') }), /*#__PURE__*/
                  _jsx("td", { children: /*#__PURE__*/
                    _jsx(ZBadge, { tone: openRow ? 'warn' : 'idle', children: openRow ? 'OPEN' : 'CLOSED' }) }
                  ), /*#__PURE__*/
                  _jsx("td", { children:
                    openRow && /*#__PURE__*/
                    _jsxs("div", { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }, children: [/*#__PURE__*/
                      _jsxs(ZSelect, {
                        value: selected[id] ?? '',
                        onChange: (e) => setSelected((prev) => ({ ...prev, [id]: e.target.value })),
                        style: { minHeight: 40, width: 'auto' }, children: [/*#__PURE__*/

                        _jsx("option", { value: "", children: "Select code" }),
                        codes.map((c) => /*#__PURE__*/
                        _jsxs("option", { value: c.code, children: [
                          c.code, " \u2014 ", c.label] }, c.code
                        )
                        )] }
                      ), /*#__PURE__*/
                      _jsx(ZInput, {
                        placeholder: "Reason",
                        value: reasons[id] ?? '',
                        onChange: (e) => setReasons((prev) => ({ ...prev, [id]: e.target.value })),
                        style: { minHeight: 40, width: 120 } }
                      ), /*#__PURE__*/
                      _jsx(ZButton, {
                        variant: "ghost",
                        size: "sm",
                        disabled: !selected[id],
                        onClick: () => void onCode(id, selected[id], reasons[id] ?? ''), children:
                        "Code" }

                      )] }
                    ) }

                  )] }, id
                ));

            }) }
          )] }
        ) }
      ),

      open.length > 0 && /*#__PURE__*/
      _jsxs("p", { style: { color: 'var(--color-warning)', marginTop: '0.5rem', fontWeight: 600 }, children: [
        open.length, " open stoppage(s) \u2014 code before shift close."] }
      )] }

    ));

}