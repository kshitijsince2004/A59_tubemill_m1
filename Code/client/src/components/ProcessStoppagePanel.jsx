import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { stoppageApi } from '../api/plantApi';
import { ZButton, ZSelect, ZInput } from '../ui';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";







export function ProcessStoppagePanel({ processCode, sourceId, disabled, onChanged }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);

  const { data: codes = [] } = useQuery({
    queryKey: ['stoppage-codes', processCode],
    queryFn: () => stoppageApi.codes(processCode)
  });

  const { data: stoppages = [] } = useQuery({
    queryKey: ['process-stoppages', processCode, sourceId],
    queryFn: () => stoppageApi.list(processCode, sourceId),
    enabled: Boolean(sourceId)
  });

  const open = stoppages.find((s) => s.is_open === true || s.is_open === 't' || s.is_open === 'true');

  function notifyChanged() {
    void qc.invalidateQueries({ queryKey: ['process-stoppages', processCode, sourceId] });
    onChanged?.();
  }

  if (!sourceId) return null;

  return (/*#__PURE__*/
    _jsxs("div", { className: "panel", style: { marginTop: 12 }, children: [/*#__PURE__*/
      _jsx("h3", { children: "Stoppages" }),
      err && /*#__PURE__*/_jsx("p", { style: { color: 'var(--color-destructive)' }, children: err }),
      open ? /*#__PURE__*/
      _jsxs("div", { className: "btn-row", children: [/*#__PURE__*/
        _jsxs("span", { children: ["Open: ",
          String(open.stoppage_code), " since ", String(open.from_time)] }
        ), /*#__PURE__*/
        _jsx(ZButton, {
          variant: "ghost",
          disabled: disabled,
          onClick: () =>
          void stoppageApi.
          close(processCode, sourceId).
          then(() => notifyChanged()).
          catch((e) => setErr(e instanceof Error ? e.message : 'Close failed')), children:

          "Close stoppage" }

        )] }
      ) : /*#__PURE__*/

      _jsxs("div", { className: "form-grid", children: [/*#__PURE__*/
        _jsxs("label", { children: ["Code", /*#__PURE__*/

          _jsxs(ZSelect, { value: code, onChange: (e) => setCode(e.target.value), disabled: disabled, children: [/*#__PURE__*/
            _jsx("option", { value: "", children: "Select\u2026" }),
            codes.map((c) => /*#__PURE__*/
            _jsxs("option", { value: String(c.code), children: [
              String(c.code), " \u2014 ", String(c.label ?? '')] }, String(c.code)
            )
            )] }
          )] }
        ), /*#__PURE__*/
        _jsxs("label", { children: ["Reason", /*#__PURE__*/

          _jsx(ZInput, { value: reason, onChange: (e) => setReason(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsx(ZButton, {
          variant: "primary",
          disabled: disabled || !code,
          onClick: () =>
          void stoppageApi.
          open({ processCode, sourceId, stoppageCode: code, reason }).
          then(() => {
            setCode('');
            setReason('');
            notifyChanged();
          }).
          catch((e) => setErr(e instanceof Error ? e.message : 'Open failed')), children:

          "Open stoppage" }

        )] }
      ), /*#__PURE__*/

      _jsx("ul", { style: { marginTop: 8, fontSize: 13 }, children:
        stoppages.slice(0, 5).map((s) => /*#__PURE__*/
        _jsxs("li", { children: [
          String(s.stoppage_code), " \xB7 ", String(s.from_time),
          s.to_time ? ` → ${String(s.to_time)}` : ' (open)'] }, String(s.id)
        )
        ) }
      )] }
    ));

}