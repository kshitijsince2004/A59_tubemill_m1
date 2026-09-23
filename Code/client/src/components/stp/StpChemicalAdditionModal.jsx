import { useEffect, useState } from 'react';
import FormModal from '../FormModal';
import { ZButton, ZInput, ZSelect } from '../../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

const BATHS = [
  'DEGREASE',
  'PICKLE',
  'ACT',
  'PHOS',
  'NEUT',
  'LUBE',
  'RINSE',
  'OIL',
];

const EMPTY = {
  bathCode: 'PHOS',
  chemical: '',
  quantity: '',
  unit: 'kg',
  batchRef: '',
  remarks: '',
};

export default function StpChemicalAdditionModal({ open, busy = false, onClose, onSave }) {
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFields(EMPTY);
    setError('');
  }, [open]);

  async function handleSave() {
    setError('');
    if (!fields.bathCode || !fields.chemical.trim()) {
      setError('Bath and chemical are required');
      return;
    }
    try {
      await onSave?.({
        bathCode: fields.bathCode,
        chemical: fields.chemical.trim(),
        quantity: fields.quantity === '' ? undefined : Number(fields.quantity),
        unit: fields.unit || undefined,
        batchRef: fields.batchRef || undefined,
        remarks: fields.remarks || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return /*#__PURE__*/ _jsx(FormModal, {
    open,
    eyebrow: 'Capture',
    title: 'Chemical Addition',
    onClose,
    footer: /*#__PURE__*/ _jsxs('div', {
      className: 'furnace-cons-modal__footer',
      children: [
        /*#__PURE__*/ _jsx(ZButton, { variant: 'ghost', disabled: busy, onClick: onClose, children: 'Cancel' }),
        /*#__PURE__*/ _jsx(ZButton, {
          variant: 'primary',
          disabled: busy,
          onClick: () => void handleSave(),
          children: busy ? 'Saving…' : 'Save',
        }),
      ],
    }),
    children: /*#__PURE__*/ _jsxs('div', {
      className: 'form-grid',
      children: [
        /*#__PURE__*/ _jsxs('label', {
          children: [
            'Process / Bath',
            /*#__PURE__*/ _jsxs(ZSelect, {
              value: fields.bathCode,
              onChange: (e) => setFields((f) => ({ ...f, bathCode: e.target.value })),
              children: BATHS.map((b) =>
                /*#__PURE__*/ _jsx('option', { value: b, children: b }, b)
              ),
            }),
          ],
        }),
        /*#__PURE__*/ _jsxs('label', {
          children: [
            'Chemical',
            /*#__PURE__*/ _jsx(ZInput, {
              value: fields.chemical,
              onChange: (e) => setFields((f) => ({ ...f, chemical: e.target.value })),
              placeholder: 'e.g. 3510E',
            }),
          ],
        }),
        /*#__PURE__*/ _jsxs('label', {
          children: [
            'Quantity',
            /*#__PURE__*/ _jsx(ZInput, {
              type: 'number',
              step: 'any',
              value: fields.quantity,
              onChange: (e) => setFields((f) => ({ ...f, quantity: e.target.value })),
            }),
          ],
        }),
        /*#__PURE__*/ _jsxs('label', {
          children: [
            'Unit',
            /*#__PURE__*/ _jsx(ZInput, {
              value: fields.unit,
              onChange: (e) => setFields((f) => ({ ...f, unit: e.target.value })),
            }),
          ],
        }),
        /*#__PURE__*/ _jsxs('label', {
          className: 'span-2',
          children: [
            'Batch / Reference',
            /*#__PURE__*/ _jsx(ZInput, {
              value: fields.batchRef,
              onChange: (e) => setFields((f) => ({ ...f, batchRef: e.target.value })),
            }),
          ],
        }),
        /*#__PURE__*/ _jsxs('label', {
          className: 'span-2',
          children: [
            'Remarks',
            /*#__PURE__*/ _jsx(ZInput, {
              value: fields.remarks,
              onChange: (e) => setFields((f) => ({ ...f, remarks: e.target.value })),
            }),
          ],
        }),
        error ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error span-2', children: error }) : null,
      ],
    }),
  });
}
