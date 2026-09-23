import { useEffect, useState } from 'react';
import { ZInput } from '../ui';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';

function displayValue(value, suffix = '') {
  if (value == null || value === '') return 'No data';
  return `${value}${suffix}`;
}

function displayMt(value) {
  if (value == null || value === '') return 'No data available';
  return `${Number(value).toFixed(3)} MT`;
}

function sizePart(size, key) {
  if (!size || size[key] == null || size[key] === '') return null;
  return size[key];
}

function parseOptionalInt(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function parseOptionalMt(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/**
 * Production Console canvas — PRD fields only.
 * Start / Stop / End / Hold live on the Action Rail; stoppage opens as a popup.
 */
export default function ProductionConsolePanel({
  run,
  busy = false,
  disabled = false,
  onSaveProduction
}) {
  const production = run.production ?? {};
  const size = run.size ?? {};
  const locked =
    disabled ||
    run.runState === 'RUN_COMPLETE' ||
    ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run.status);

  const [draft, setDraft] = useState({
    primeNo: '',
    pq2JointNo: '',
    pq2OtherNo: '',
    cqNo: '',
    openNo: '',
    scrapWtMt: ''
  });
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDraft({
      primeNo: production.primeNo != null ? String(production.primeNo) : '',
      pq2JointNo: production.pq2JointNo != null ? String(production.pq2JointNo) : '',
      pq2OtherNo: production.pq2OtherNo != null ? String(production.pq2OtherNo) : '',
      cqNo: production.cqNo != null ? String(production.cqNo) : '',
      openNo: production.openNo != null ? String(production.openNo) : '',
      scrapWtMt: production.scrapWtMt != null ? String(production.scrapWtMt) : ''
    });
  }, [
    run.id,
    production.primeNo,
    production.pq2JointNo,
    production.pq2OtherNo,
    production.cqNo,
    production.openNo,
    production.scrapWtMt
  ]);

  async function saveField(partial) {
    if (locked || !onSaveProduction) return;
    setSaveError('');
    try {
      await onSaveProduction(partial);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  function onCountBlur(field, raw) {
    const parsed = parseOptionalInt(raw);
    if (parsed === undefined) {
      setSaveError('Enter a whole number ≥ 0, or leave blank');
      return;
    }
    const current = production[field] ?? null;
    if (parsed === current) return;
    void saveField({ [field]: parsed });
  }

  function onScrapBlur(raw) {
    const parsed = parseOptionalMt(raw);
    if (parsed === undefined) {
      setSaveError('Enter a weight ≥ 0 MT, or leave blank');
      return;
    }
    const current = production.scrapWtMt ?? null;
    if (parsed === current) return;
    void saveField({ scrapWtMt: parsed });
  }

  const od = sizePart(size, 'odMm') ?? sizePart(size, 'equivOdMm');
  const thk = sizePart(size, 'thkMm');
  const length = sizePart(size, 'lengthMm');

  return _jsxs(_Fragment, {
    children: [
      _jsxs('div', {
        className: 'panel',
        children: [
          _jsx('h2', { children: 'Current Production' }),
          _jsxs('div', {
            className: 'meta-grid',
            children: [
              _jsxs('div', {
                className: 'meta-grid__item',
                children: [
                  _jsx('label', { children: 'W.O. No.' }),
                  _jsx('div', {
                    className: 'value font-mono',
                    children: displayValue(run.workOrderNo)
                  })
                ]
              }),
              _jsxs('div', {
                className: 'meta-grid__item',
                children: [
                  _jsx('label', { children: 'OD' }),
                  _jsx('div', {
                    className: 'value font-mono',
                    children: od != null ? `${od} mm` : 'No data'
                  })
                ]
              }),
              _jsxs('div', {
                className: 'meta-grid__item',
                children: [
                  _jsx('label', { children: 'THK.' }),
                  _jsx('div', {
                    className: 'value font-mono',
                    children: thk != null ? `${thk} mm` : 'No data'
                  })
                ]
              }),
              _jsxs('div', {
                className: 'meta-grid__item',
                children: [
                  _jsx('label', { children: 'LENGTH' }),
                  _jsx('div', {
                    className: 'value font-mono',
                    children: length != null ? `${length} mm` : 'No data'
                  })
                ]
              }),
              _jsxs('div', {
                className: 'meta-grid__item',
                children: [
                  _jsx('label', { children: 'SLIT No.' }),
                  _jsx('div', {
                    className: 'value font-mono',
                    children: displayValue(run.slitNo)
                  })
                ]
              }),
              _jsxs('div', {
                className: 'meta-grid__item',
                children: [
                  _jsx('label', { children: 'CUSTOMER' }),
                  _jsx('div', {
                    className: 'value',
                    children: displayValue(run.customerCode)
                  })
                ]
              }),
              _jsxs('div', {
                className: 'meta-grid__item',
                children: [
                  _jsx('label', { children: 'RM GRADE / SOURCE' }),
                  _jsx('div', {
                    className: 'value font-mono',
                    children: displayValue(run.gradeCode)
                  })
                ]
              })
            ]
          })
        ]
      }),

      _jsxs('div', {
        className: 'panel',
        children: [
          _jsx('h2', { children: 'Production Output' }),
          saveError ? _jsx('p', { className: 'error-text', children: saveError }) : null,
          _jsxs('table', {
            className: 'prod-table',
            children: [
              _jsx('thead', {
                children: _jsxs('tr', {
                  children: [
                    _jsx('th', { children: 'Class' }),
                    _jsx('th', { children: 'No. (pcs)' }),
                    _jsx('th', { children: 'Wt. (MT)' })
                  ]
                })
              }),
              _jsxs('tbody', {
                children: [
                  _jsxs('tr', {
                    children: [
                      _jsx('td', { children: 'PRIME' }),
                      _jsx('td', {
                        children: _jsx(ZInput, {
                          type: 'number',
                          min: 0,
                          step: 1,
                          inputMode: 'numeric',
                          disabled: locked || busy,
                          value: draft.primeNo,
                          placeholder: '—',
                          onChange: (e) => setDraft((d) => ({ ...d, primeNo: e.target.value })),
                          onBlur: (e) => onCountBlur('primeNo', e.target.value),
                          'aria-label': 'Prime No.'
                        })
                      }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: displayMt(production.primeWtMt)
                      })
                    ]
                  }),
                  _jsxs('tr', {
                    children: [
                      _jsx('td', { children: 'PQ2 — JOINT' }),
                      _jsx('td', {
                        children: _jsx(ZInput, {
                          type: 'number',
                          min: 0,
                          step: 1,
                          inputMode: 'numeric',
                          disabled: locked || busy,
                          value: draft.pq2JointNo,
                          placeholder: '—',
                          onChange: (e) => setDraft((d) => ({ ...d, pq2JointNo: e.target.value })),
                          onBlur: (e) => onCountBlur('pq2JointNo', e.target.value),
                          'aria-label': 'PQ2 Joint No.'
                        })
                      }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: displayMt(production.pq2JointWtMt)
                      })
                    ]
                  }),
                  _jsxs('tr', {
                    children: [
                      _jsx('td', { children: 'PQ2 — OTHER' }),
                      _jsx('td', {
                        children: _jsx(ZInput, {
                          type: 'number',
                          min: 0,
                          step: 1,
                          inputMode: 'numeric',
                          disabled: locked || busy,
                          value: draft.pq2OtherNo,
                          placeholder: '—',
                          onChange: (e) => setDraft((d) => ({ ...d, pq2OtherNo: e.target.value })),
                          onBlur: (e) => onCountBlur('pq2OtherNo', e.target.value),
                          'aria-label': 'PQ2 Other No.'
                        })
                      }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: displayMt(production.pq2OtherWtMt)
                      })
                    ]
                  }),
                  _jsxs('tr', {
                    children: [
                      _jsx('td', { children: 'CQ' }),
                      _jsx('td', {
                        children: _jsx(ZInput, {
                          type: 'number',
                          min: 0,
                          step: 1,
                          inputMode: 'numeric',
                          disabled: locked || busy,
                          value: draft.cqNo,
                          placeholder: '—',
                          onChange: (e) => setDraft((d) => ({ ...d, cqNo: e.target.value })),
                          onBlur: (e) => onCountBlur('cqNo', e.target.value),
                          'aria-label': 'CQ No.'
                        })
                      }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: displayMt(production.cqWtMt)
                      })
                    ]
                  }),
                  _jsxs('tr', {
                    children: [
                      _jsx('td', { children: 'OPEN' }),
                      _jsx('td', {
                        children: _jsx(ZInput, {
                          type: 'number',
                          min: 0,
                          step: 1,
                          inputMode: 'numeric',
                          disabled: locked || busy,
                          value: draft.openNo,
                          placeholder: '—',
                          onChange: (e) => setDraft((d) => ({ ...d, openNo: e.target.value })),
                          onBlur: (e) => onCountBlur('openNo', e.target.value),
                          'aria-label': 'Open No.'
                        })
                      }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: displayMt(production.openWtMt)
                      })
                    ]
                  }),
                  _jsxs('tr', {
                    children: [
                      _jsx('td', { children: 'SCRAP' }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: '—'
                      }),
                      _jsx('td', {
                        children: locked
                          ? _jsx('span', {
                              className: 'font-mono readonly-cell',
                              children: displayMt(production.scrapWtMt ?? run.totalScrapMt)
                            })
                          : _jsx(ZInput, {
                              type: 'number',
                              min: 0,
                              step: '0.001',
                              inputMode: 'decimal',
                              disabled: busy,
                              value: draft.scrapWtMt,
                              placeholder: 'MT',
                              onChange: (e) =>
                                setDraft((d) => ({ ...d, scrapWtMt: e.target.value })),
                              onBlur: (e) => onScrapBlur(e.target.value),
                              'aria-label': 'Scrap Wt MT'
                            })
                      })
                    ]
                  }),
                  _jsxs('tr', {
                    className: 'prod-table__total',
                    children: [
                      _jsx('td', { children: 'TOTAL' }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: displayValue(production.totalNo)
                      }),
                      _jsx('td', {
                        className: 'font-mono readonly-cell',
                        children: displayMt(production.totalWtMt)
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}
