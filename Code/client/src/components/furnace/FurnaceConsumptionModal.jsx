import { useEffect, useMemo, useState } from 'react';
import FormModal from '../FormModal';
import { ZButton, ZInput, ZSelect } from '../../ui';
import { getFurnaceMeta, machineCodeOf } from '../../lib/furnaceMeta';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

const EMPTY = { pngA: '', pngB: '', pngC: '', nh3A: '', nh3B: '', nh3C: '' };

function numOrEmpty(v) {
  if (v == null || v === '') return '';
  return String(v);
}

function toPayload(fields) {
  const out = {};
  for (const key of Object.keys(EMPTY)) {
    const raw = fields[key];
    if (raw === '' || raw == null) out[key] = null;
    else {
      const n = Number(raw);
      out[key] = Number.isFinite(n) ? n : null;
    }
  }
  return out;
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Independent PNG/NH3 A–C consumption — furnace + date, not tied to a production run.
 */
export default function FurnaceConsumptionModal({
  open,
  busy = false,
  machines = [],
  defaultFurnaceCode,
  defaultProdDate,
  shiftRef,
  contextChargeNo,
  contextWorkOrderNo,
  initial,
  onFurnaceChange,
  onDateChange,
  onClose,
  onSave,
}) {
  const [furnaceCode, setFurnaceCode] = useState(defaultFurnaceCode || '');
  const [prodDate, setProdDate] = useState(defaultProdDate || todayIsoDate());
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState('');

  const furnaceMeta = useMemo(
    () => getFurnaceMeta(machines, furnaceCode),
    [machines, furnaceCode]
  );

  useEffect(() => {
    if (!open) return;
    setError('');
    const nextFurnace =
      defaultFurnaceCode ||
      (machines.length ? machineCodeOf(machines[0]) : '');
    setFurnaceCode(nextFurnace);
    setProdDate(defaultProdDate || todayIsoDate());
  }, [open, defaultFurnaceCode, defaultProdDate, machines]);

  useEffect(() => {
    if (!open) return;
    setFields({
      pngA: numOrEmpty(initial?.pngA ?? initial?.pngConsumption),
      pngB: numOrEmpty(initial?.pngB),
      pngC: numOrEmpty(initial?.pngC),
      nh3A: numOrEmpty(initial?.nh3A ?? initial?.nh3Consumption),
      nh3B: numOrEmpty(initial?.nh3B),
      nh3C: numOrEmpty(initial?.nh3C),
    });
  }, [open, initial]);

  function setVal(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setError('');
    if (!furnaceCode) {
      setError('Select a furnace');
      return;
    }
    if (!prodDate) {
      setError('Date required');
      return;
    }
    try {
      await onSave?.({
        furnaceCode,
        prodDate,
        shiftRef: shiftRef || undefined,
        ...toPayload(fields),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return /*#__PURE__*/ _jsx(FormModal, {
    open,
    eyebrow: 'Furnace',
    title: 'Consumption',
    className: 'furnace-cons-modal',
    onClose,
    footer: /*#__PURE__*/ _jsxs('div', {
      className: 'furnace-cons-modal__footer',
      children: [
        /*#__PURE__*/ _jsx(ZButton, {
          variant: 'ghost',
          disabled: busy,
          onClick: onClose,
          children: 'Cancel',
        }),
        /*#__PURE__*/ _jsx(ZButton, {
          variant: 'primary',
          disabled: busy || !furnaceCode,
          onClick: () => void handleSave(),
          children: busy ? 'Saving…' : 'Save Consumption',
        }),
      ],
    }),
    children: /*#__PURE__*/ _jsxs('div', {
      className: 'furnace-cons-modal__body',
      children: [
        /*#__PURE__*/ _jsxs('div', {
          className: 'furnace-cons-modal__pickers',
          children: [
            /*#__PURE__*/ _jsxs('label', {
              className: 'furnace-cons-modal__field',
              children: [
                /*#__PURE__*/ _jsx('span', { children: 'Furnace' }),
                /*#__PURE__*/ _jsxs(ZSelect, {
                  value: furnaceCode,
                  onChange: (e) => {
                    const code = e.target.value;
                    setFurnaceCode(code);
                    onFurnaceChange?.(code);
                  },
                  children: [
                    /*#__PURE__*/ _jsx('option', { value: '', children: 'Select furnace…' }),
                    machines.map((m) =>
                      /*#__PURE__*/ _jsx(
                        'option',
                        { value: machineCodeOf(m), children: machineCodeOf(m) },
                        machineCodeOf(m)
                      )
                    ),
                  ],
                }),
              ],
            }),
            /*#__PURE__*/ _jsxs('label', {
              className: 'furnace-cons-modal__field',
              children: [
                /*#__PURE__*/ _jsx('span', { children: 'Date' }),
                /*#__PURE__*/ _jsx(ZInput, {
                  type: 'date',
                  value: prodDate,
                  onChange: (e) => {
                    setProdDate(e.target.value);
                    onDateChange?.(e.target.value);
                  },
                }),
              ],
            }),
          ],
        }),
        /*#__PURE__*/ _jsxs('dl', {
          className: 'furnace-cons-modal__meta',
          children: [
            /*#__PURE__*/ _jsx('dt', { children: 'Gas Type' }),
            /*#__PURE__*/ _jsx('dd', { children: furnaceMeta?.gasType || '—' }),
            /*#__PURE__*/ _jsx('dt', { children: 'Shift' }),
            /*#__PURE__*/ _jsx('dd', { children: shiftRef || '—' }),
            /*#__PURE__*/ _jsx('dt', { children: 'Active Order' }),
            /*#__PURE__*/ _jsx('dd', {
              className: 'font-mono',
              children: contextChargeNo || '—',
            }),
            /*#__PURE__*/ _jsx('dt', { children: 'Work Order' }),
            /*#__PURE__*/ _jsx('dd', {
              className: 'font-mono',
              children: contextWorkOrderNo || '—',
            }),
            /*#__PURE__*/ _jsx('dt', { children: 'Source' }),
            /*#__PURE__*/ _jsx('dd', { children: 'MANUAL' }),
          ],
        }),
        /*#__PURE__*/ _jsx('p', {
          className: 'muted furnace-cons-modal__hint',
          children: 'Independent of production runs — enter PNG / NH₃ by shift column A / B / C.',
        }),
        /*#__PURE__*/ _jsxs('div', {
          className: 'furnace-cons-modal__matrix',
          role: 'group',
          'aria-label': 'PNG and NH3 consumption by shift column',
          children: [
            /*#__PURE__*/ _jsx('div', { className: 'furnace-cons-modal__corner', children: '' }),
            /*#__PURE__*/ _jsx('div', { className: 'furnace-cons-modal__colhead', children: 'A' }),
            /*#__PURE__*/ _jsx('div', { className: 'furnace-cons-modal__colhead', children: 'B' }),
            /*#__PURE__*/ _jsx('div', { className: 'furnace-cons-modal__colhead', children: 'C' }),
            /*#__PURE__*/ _jsx('div', { className: 'furnace-cons-modal__rowhead', children: 'PNG' }),
            /*#__PURE__*/ _jsx(ZInput, {
              type: 'number',
              step: 'any',
              value: fields.pngA,
              onChange: (e) => setVal('pngA', e.target.value),
              'aria-label': 'PNG A',
            }),
            /*#__PURE__*/ _jsx(ZInput, {
              type: 'number',
              step: 'any',
              value: fields.pngB,
              onChange: (e) => setVal('pngB', e.target.value),
              'aria-label': 'PNG B',
            }),
            /*#__PURE__*/ _jsx(ZInput, {
              type: 'number',
              step: 'any',
              value: fields.pngC,
              onChange: (e) => setVal('pngC', e.target.value),
              'aria-label': 'PNG C',
            }),
            /*#__PURE__*/ _jsx('div', { className: 'furnace-cons-modal__rowhead', children: 'NH₃' }),
            /*#__PURE__*/ _jsx(ZInput, {
              type: 'number',
              step: 'any',
              value: fields.nh3A,
              onChange: (e) => setVal('nh3A', e.target.value),
              'aria-label': 'NH3 A',
            }),
            /*#__PURE__*/ _jsx(ZInput, {
              type: 'number',
              step: 'any',
              value: fields.nh3B,
              onChange: (e) => setVal('nh3B', e.target.value),
              'aria-label': 'NH3 B',
            }),
            /*#__PURE__*/ _jsx(ZInput, {
              type: 'number',
              step: 'any',
              value: fields.nh3C,
              onChange: (e) => setVal('nh3C', e.target.value),
              'aria-label': 'NH3 C',
            }),
          ],
        }),
        error
          ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error', children: error })
          : null,
      ],
    }),
  });
}
