import { useState } from 'react';
import { ZButton, ZTextarea } from '../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

function mt(v) {
  if (v == null || v === '') return 'No data';
  return `${Number(v).toFixed(3)} MT`;
}

function pcs(v) {
  if (v == null || v === '') return 'No data';
  return String(v);
}

export default function EndRunDialog({ open, busy, run, onCancel, onConfirm }) {
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const p = run?.production ?? {};

  return (
    _jsx('div', {
      className: 'modal-scrim',
      role: 'presentation',
      onClick: onCancel,
      children: _jsxs('div', {
        className: 'modal-card',
        role: 'dialog',
        'aria-labelledby': 'end-run-title',
        onClick: (e) => e.stopPropagation(),
        children: [
          _jsxs('header', {
            className: 'modal-card__header',
            children: [
              _jsxs('div', {
                children: [
                  _jsx('div', { className: 'eyebrow', children: 'End work' }),
                  _jsx('h2', { id: 'end-run-title', children: 'Complete production run' }),
                  _jsx('p', {
                    className: 'muted',
                    children:
                      'This permanently completes the production run. Confirm the final production figures below.'
                  })
                ]
              }),
              _jsx('button', {
                type: 'button',
                className: 'modal-card__close',
                onClick: onCancel,
                'aria-label': 'Close',
                children: '✕'
              })
            ]
          }),
          _jsxs('div', {
            className: 'modal-card__body',
            children: [
              error && _jsx('p', { className: 'error-text', children: error }),
              _jsxs('div', {
                className: 'meta-grid',
                children: [
                  _jsxs('div', {
                    className: 'meta-grid__item',
                    children: [
                      _jsx('label', { children: 'W.O.' }),
                      _jsx('div', {
                        className: 'value font-mono',
                        children: run?.workOrderNo ?? '—'
                      })
                    ]
                  }),
                  _jsxs('div', {
                    className: 'meta-grid__item',
                    children: [
                      _jsx('label', { children: 'Run' }),
                      _jsx('div', {
                        className: 'value font-mono',
                        children: run?.runNo ?? '—'
                      })
                    ]
                  }),
                  _jsxs('div', {
                    className: 'meta-grid__item',
                    children: [
                      _jsx('label', { children: 'Prime' }),
                      _jsx('div', {
                        className: 'value font-mono',
                        children: `${pcs(p.primeNo)} · ${mt(p.primeWtMt)}`
                      })
                    ]
                  }),
                  _jsxs('div', {
                    className: 'meta-grid__item',
                    children: [
                      _jsx('label', { children: 'PQ2' }),
                      _jsx('div', {
                        className: 'value font-mono',
                        children: `${pcs(
                          p.pq2JointNo != null || p.pq2OtherNo != null
                            ? (p.pq2JointNo ?? 0) + (p.pq2OtherNo ?? 0)
                            : null
                        )} · ${mt(
                          p.pq2JointWtMt != null || p.pq2OtherWtMt != null
                            ? (p.pq2JointWtMt ?? 0) + (p.pq2OtherWtMt ?? 0)
                            : null
                        )}`
                      })
                    ]
                  }),
                  _jsxs('div', {
                    className: 'meta-grid__item',
                    children: [
                      _jsx('label', { children: 'CQ / Open' }),
                      _jsx('div', {
                        className: 'value font-mono',
                        children: `${pcs(p.cqNo)} / ${pcs(p.openNo)}`
                      })
                    ]
                  }),
                  _jsxs('div', {
                    className: 'meta-grid__item',
                    children: [
                      _jsx('label', { children: 'Total' }),
                      _jsx('div', {
                        className: 'value font-mono',
                        children: `${pcs(p.totalNo)} · ${mt(p.totalWtMt)}`
                      })
                    ]
                  }),
                  _jsxs('div', {
                    className: 'meta-grid__item',
                    children: [
                      _jsx('label', { children: 'Raw / Scrap / Yield' }),
                      _jsx('div', {
                        className: 'value font-mono',
                        children: `${mt(run?.rawMaterialMt)} · ${mt(
                          p.scrapWtMt ?? run?.totalScrapMt
                        )} · ${run?.yieldPct != null ? `${run.yieldPct}%` : 'No data'}`
                      })
                    ]
                  })
                ]
              }),
              _jsx('label', { className: 'eyebrow', children: 'Remark (optional)' }),
              _jsx(ZTextarea, {
                value: remark,
                onChange: (e) => setRemark(e.target.value),
                rows: 3,
                placeholder: 'Optional end remark',
                autoFocus: true
              })
            ]
          }),
          _jsxs('footer', {
            className: 'modal-card__footer',
            children: [
              _jsx(ZButton, {
                variant: 'ghost',
                onClick: onCancel,
                disabled: busy,
                children: 'Cancel'
              }),
              _jsx(ZButton, {
                variant: 'danger',
                disabled: busy,
                onClick: () => {
                  setError('');
                  onConfirm(remark.trim() || undefined);
                },
                children: 'Confirm END WORK'
              })
            ]
          })
        ]
      })
    })
  );
}
