import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { tubemillApi } from '../api/tubemillClient';
import { ZButton, ZInput, ZSelect, ZTextarea } from '../ui';import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";













export default function HoldDefectDialog({ open, busy, onCancel, onConfirm }) {
  const codes = useQuery({ queryKey: ['defect-codes'], queryFn: () => tubemillApi.getDefectCodes(), enabled: open });
  const [defectCode, setDefectCode] = useState('');
  const [pieces, setPieces] = useState('');
  const [quantityMt, setQuantityMt] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  return (/*#__PURE__*/
    _jsx("div", { className: "modal-scrim", role: "presentation", onClick: onCancel, children: /*#__PURE__*/
      _jsxs("div", {
        className: "modal-card",
        role: "dialog",
        "aria-labelledby": "hold-defect-title",
        onClick: (e) => e.stopPropagation(), children: [/*#__PURE__*/

        _jsxs("header", { className: "modal-card__header", children: [/*#__PURE__*/
          _jsxs("div", { children: [/*#__PURE__*/
            _jsx("div", { className: "eyebrow", children: "Hold" }), /*#__PURE__*/
            _jsx("h2", { id: "hold-defect-title", children: "Log defect & hold" })] }
          ), /*#__PURE__*/
          _jsx("button", { type: "button", className: "modal-card__close", onClick: onCancel, "aria-label": "Close", children: "\u2715" }

          )] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "modal-card__body", children: [
          error && /*#__PURE__*/_jsx("p", { className: "error-text", children: error }), /*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "Defect code" }), /*#__PURE__*/
          _jsxs(ZSelect, { value: defectCode, onChange: (e) => setDefectCode(e.target.value), required: true, children: [/*#__PURE__*/
            _jsx("option", { value: "", children: "Select\u2026" }),
            (codes.data ?? []).map((c) => /*#__PURE__*/
            _jsxs("option", { value: c.code, children: [
              c.code, " \u2014 ", c.label] }, c.code
            )
            )] }
          ), /*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "Pieces" }), /*#__PURE__*/
          _jsx(ZInput, { type: "number", value: pieces, onChange: (e) => setPieces(e.target.value), placeholder: "Optional" }), /*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "Quantity MT" }), /*#__PURE__*/
          _jsx(ZInput, {
            type: "number",
            step: "0.001",
            value: quantityMt,
            onChange: (e) => setQuantityMt(e.target.value),
            placeholder: "Optional" }
          ), /*#__PURE__*/
          _jsx("label", { className: "eyebrow", children: "Remark" }), /*#__PURE__*/
          _jsx(ZTextarea, { value: remark, onChange: (e) => setRemark(e.target.value), rows: 3, placeholder: "Optional" })] }
        ), /*#__PURE__*/
        _jsxs("footer", { className: "modal-card__footer", children: [/*#__PURE__*/
          _jsx(ZButton, { variant: "ghost", onClick: onCancel, disabled: busy, children: "Cancel" }

          ), /*#__PURE__*/
          _jsx(ZButton, {
            variant: "accent",
            disabled: busy,
            onClick: () => {
              if (!defectCode) {
                setError('Defect code is required');
                return;
              }
              setError('');
              onConfirm({
                defectCode,
                pieces: pieces ? Number(pieces) : undefined,
                quantityMt: quantityMt ? Number(quantityMt) : undefined,
                remark: remark.trim() || undefined
              });
            }, children:
            "Hold" }

          )] }
        )] }
      ) }
    ));

}