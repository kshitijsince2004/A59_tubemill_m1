import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tubemillApi } from '../api/tubemillClient';
import { ZButton, ZBadge, ZInput } from '../ui';import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";







export default function ConsumablesPanel({ workCoilId, runId, disabled }) {
  const qc = useQueryClient();
  const { data: consumables = [] } = useQuery({
    queryKey: ['consumables'],
    queryFn: () => tubemillApi.getConsumables(),
    refetchInterval: 10000
  });
  const [note, setNote] = useState('');
  const current = consumables.find((c) => String(c.code) === String(workCoilId));

  return (/*#__PURE__*/
    _jsxs("div", { className: "panel", children: [/*#__PURE__*/
      _jsx("h2", { children: "Consumables / Tooling Life" }),
      current ? /*#__PURE__*/
      _jsxs(_Fragment, { children: [/*#__PURE__*/
        _jsxs("p", { children: ["Work coil ", /*#__PURE__*/
          _jsx("strong", { className: "font-mono", children: String(current.code) }), " \xB7", ' ', /*#__PURE__*/
          _jsxs("span", { className: "font-mono", children: [Number(current.cumulative_tonnage_mt ?? 0).toFixed(3), " MT"] }), " \xB7 uses", ' ', /*#__PURE__*/
          _jsx("span", { className: "font-mono", children: String(current.cumulative_uses ?? 0) })] }
        ),
        Boolean(current.changeDue) && /*#__PURE__*/
        _jsx("div", { className: "exception-banner", style: { marginBottom: '0.75rem' }, children: "CHANGE DUE \u2014 replace threshold reached" }

        ), /*#__PURE__*/

        _jsx("div", { className: "form-row", children: /*#__PURE__*/
          _jsxs("div", { children: [/*#__PURE__*/
            _jsx("label", { children: "Visual inspection" }), /*#__PURE__*/
            _jsx(ZInput, { value: note, onChange: (e) => setNote(e.target.value), disabled: disabled })] }
          ) }
        ), /*#__PURE__*/
        _jsx(ZButton, {
          variant: "ghost",
          disabled: disabled || !note,
          onClick: () =>
          void tubemillApi.
          inspectConsumable(String(current.code), note, 'INSPECT', runId).
          then(() => {
            setNote('');
            void qc.invalidateQueries({ queryKey: ['consumables'] });
          }), children:

          "Record Inspection" }

        )] }
      ) : /*#__PURE__*/

      _jsx("p", { style: { color: 'var(--color-muted-foreground)' }, children: "No work coil linked yet (confirm tooling first)." }), /*#__PURE__*/

      _jsxs("table", { className: "table", style: { marginTop: '1rem' }, children: [/*#__PURE__*/
        _jsx("thead", { children: /*#__PURE__*/
          _jsxs("tr", { children: [/*#__PURE__*/
            _jsx("th", { children: "Code" }), /*#__PURE__*/
            _jsx("th", { children: "Kind" }), /*#__PURE__*/
            _jsx("th", { children: "MT" }), /*#__PURE__*/
            _jsx("th", { children: "Status" })] }
          ) }
        ), /*#__PURE__*/
        _jsx("tbody", { children:
          consumables.map((c) => /*#__PURE__*/
          _jsxs("tr", { children: [/*#__PURE__*/
            _jsx("td", { children: String(c.code) }), /*#__PURE__*/
            _jsx("td", { children: String(c.kind) }), /*#__PURE__*/
            _jsx("td", { children: Number(c.cumulative_tonnage_mt ?? 0).toFixed(2) }), /*#__PURE__*/
            _jsx("td", { children: /*#__PURE__*/
              _jsx(ZBadge, { tone: c.changeDue ? 'warn' : 'idle', children:
                c.changeDue ? 'CHANGE_DUE' : String(c.status) }
              ) }
            )] }, String(c.code)
          )
          ) }
        )] }
      )] }
    ));

}