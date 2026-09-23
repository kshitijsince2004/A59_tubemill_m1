import { useEffect, useState } from 'react';
import { ZButton, ZInput, ZSelect, ZTextarea } from '../ui';
import { formatElapsed } from '../lib/operatorClock';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

function isOpenFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const s = String(value).toLowerCase();
  return s === 't' || s === 'true' || s === '1' || s === 'yes';
}

/**
 * Stoppage popup — opens from Action Rail STOPPAGE / Manage Stop.
 * Times (from / to / duration) are system-generated; operator enters code, reason, remark.
 */
export default function StoppageDialog({
  open,
  busy = false,
  mode = 'open', // 'open' | 'manage'
  stoppageCodes = [],
  stoppages = [],
  openStoppage = null,
  onCancel,
  onConfirm
}) {
  const [stoppageCode, setStoppageCode] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (openStoppage) {
      setStoppageCode(String(openStoppage.stoppage_code ?? ''));
      setReason(String(openStoppage.reason ?? ''));
      setRemark(String(openStoppage.remark ?? ''));
    } else {
      setStoppageCode('');
      setReason('');
      setRemark('');
    }
  }, [open, openStoppage?.id]);

  if (!open) return null;

  const managing = mode === 'manage' || !!openStoppage;

  return _jsx('div', {
    className: 'modal-scrim',
    role: 'presentation',
    onClick: onCancel,
    children: _jsxs('div', {
      className: 'modal-card modal-card--stoppage',
      role: 'dialog',
      'aria-labelledby': 'stoppage-dialog-title',
      onClick: (e) => e.stopPropagation(),
      children: [
        _jsxs('header', {
          className: 'modal-card__header',
          children: [
            _jsxs('div', {
              children: [
                _jsx('div', { className: 'eyebrow', children: managing ? 'Manage stop' : 'Stoppage' }),
                _jsx('h2', {
                  id: 'stoppage-dialog-title',
                  children: managing ? 'Update stoppage' : 'Log stoppage'
                }),
                _jsx('p', {
                  className: 'muted',
                  children: 'Enter stoppage code and reason. Times are system-generated.'
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
            error ? _jsx('p', { className: 'error-text', children: error }) : null,

            managing && openStoppage
              ? _jsxs('div', {
                  className: 'meta-grid',
                  children: [
                    _jsxs('div', {
                      className: 'meta-grid__item',
                      children: [
                        _jsx('label', { children: 'From' }),
                        _jsx('div', {
                          className: 'value font-mono',
                          children: openStoppage.from_time
                            ? new Date(openStoppage.from_time).toLocaleString()
                            : '—'
                        })
                      ]
                    }),
                    _jsxs('div', {
                      className: 'meta-grid__item',
                      children: [
                        _jsx('label', { children: 'To' }),
                        _jsx('div', {
                          className: 'value font-mono',
                          children: openStoppage.to_time
                            ? new Date(openStoppage.to_time).toLocaleString()
                            : 'Open'
                        })
                      ]
                    }),
                    _jsxs('div', {
                      className: 'meta-grid__item',
                      children: [
                        _jsx('label', { children: 'Duration / Time lost' }),
                        _jsx('div', {
                          className: 'value font-mono',
                          children:
                            openStoppage.duration_min != null
                              ? `${Number(openStoppage.duration_min).toFixed(1)} min`
                              : openStoppage.from_time
                                ? formatElapsed(openStoppage.from_time)
                                : '—'
                        })
                      ]
                    })
                  ]
                })
              : null,

            _jsx('label', { className: 'eyebrow', children: 'Stoppage Code' }),
            _jsxs(ZSelect, {
              value: stoppageCode,
              onChange: (e) => setStoppageCode(e.target.value),
              disabled: busy,
              autoFocus: true,
              children: [
                _jsx('option', { value: '', children: 'Select code…' }, '__none'),
                ...stoppageCodes.map((c, i) => {
                  const code = String(c?.code ?? c ?? i);
                  const label = c?.label ?? c?.description;
                  return _jsx(
                    'option',
                    { value: code, children: label ? `${code} — ${label}` : code },
                    code
                  );
                })
              ]
            }),

            _jsx('label', { className: 'eyebrow', children: 'Reason' }),
            _jsx(ZInput, {
              value: reason,
              onChange: (e) => setReason(e.target.value),
              disabled: busy,
              placeholder: 'Stoppage reason'
            }),

            _jsx('label', { className: 'eyebrow', children: 'Remark' }),
            _jsx(ZTextarea, {
              value: remark,
              onChange: (e) => setRemark(e.target.value),
              disabled: busy,
              rows: 3,
              placeholder: 'Optional remark'
            }),

            stoppages.length > 0
              ? _jsxs('div', {
                  className: 'prod-console__stop-list',
                  children: [
                    _jsx('h3', { children: 'Stoppage history' }),
                    _jsx('ul', {
                      children: stoppages.map((s) =>
                        _jsxs(
                          'li',
                          {
                            className: 'font-mono',
                            children: [
                              String(s.stoppage_code ?? '—'),
                              ' · ',
                              s.from_time ? new Date(s.from_time).toLocaleTimeString() : '—',
                              s.to_time
                                ? ` → ${new Date(s.to_time).toLocaleTimeString()}`
                                : isOpenFlag(s.is_open)
                                  ? ' (open)'
                                  : '',
                              s.duration_min != null
                                ? ` · ${Number(s.duration_min).toFixed(1)} min`
                                : '',
                              s.reason ? ` · ${s.reason}` : ''
                            ]
                          },
                          s.id
                        )
                      )
                    })
                  ]
                })
              : null
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
              variant: managing ? 'primary' : 'danger',
              disabled: busy,
              onClick: () => {
                if (!stoppageCode.trim()) {
                  setError('Stoppage code is required');
                  return;
                }
                if (!reason.trim()) {
                  setError('Stoppage reason is required');
                  return;
                }
                setError('');
                onConfirm?.({
                  stoppageCode: stoppageCode.trim(),
                  reason: reason.trim(),
                  remark: remark.trim() || undefined
                });
              },
              children: managing ? 'Save stoppage' : 'Confirm STOPPAGE'
            })
          ]
        })
      ]
    })
  });
}
