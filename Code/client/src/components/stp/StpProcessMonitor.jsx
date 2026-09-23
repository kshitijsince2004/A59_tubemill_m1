import { useEffect, useMemo, useRef, useState } from 'react';
import { ZBadge, ZButton, ZInput, statusTone } from '../../ui';
import { formatElapsed } from '../../lib/operatorClock';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

export const STP_MONITOR_STAGES = [
  {
    id: 'DEGREASE',
    label: 'Degrease',
    target: '75–85 °C · 10–15 min',
    fields: [
      ['degreaseTempC', 'Charge Temp', '°C'],
      ['degreaseTimeMin', 'Time', 'min'],
    ],
  },
  {
    id: 'PICKLE',
    label: 'Pickle',
    target: '8–13 min',
    fields: [['descaleTimeMin', 'Time', 'min']],
  },
  {
    id: 'RINSE',
    label: 'Rinse',
    target: 'pH 2–10 (bath)',
    fields: [],
    naHint: 'Captured via Bath Analysis',
  },
  {
    id: 'ACT',
    label: 'Activation',
    target: 'pH 7–8 (bath)',
    fields: [],
    naHint: 'Captured via Bath Analysis',
  },
  {
    id: 'PHOS',
    label: 'Phosphating',
    target: '65–75 °C · 6–11 min',
    fields: [
      ['phosphateTempC', 'Temp', '°C'],
      ['phosphateTimeMin', 'Time', 'min'],
    ],
  },
  {
    id: 'NEUT',
    label: 'Neutralizer',
    target: '50–60 °C · flash',
    fields: [
      ['neutTempC', 'Temp', '°C'],
      ['neutralizerTimeMin', 'Dip', 'min'],
    ],
  },
  {
    id: 'LUBE',
    label: 'Lubrication',
    target: '70–75 °C · 7–12 min',
    fields: [
      ['lubeTempC', 'Temp', '°C'],
      ['lubeTimeMin', 'Time', 'min'],
    ],
  },
  {
    id: 'DRYER',
    label: 'Dryer',
    target: '80–120 °C · 12–17 min',
    fields: [
      ['dryerTempC', 'Temp', '°C'],
      ['dryerTimeMin', 'Time', 'min'],
    ],
  },
  {
    id: 'OIL',
    label: 'Reactive oil',
    target: '8–10 min · SF neut 65–85 °C',
    fields: [
      ['reactiveOilTimeMin', 'Oil', 'min'],
      ['sfNeutTempC', 'SF neut', '°C'],
    ],
  },
];

function numOrUndef(v) {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function useTick(enabled) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = window.setInterval(() => setN((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
}

function SwipeControl({ disabled, label, onComplete }) {
  const trackRef = useRef(null);
  const [pct, setPct] = useState(0);
  const dragging = useRef(false);

  function setFromClientX(clientX) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setPct((x / rect.width) * 100);
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    if (pct >= 72 && !disabled) {
      setPct(100);
      void Promise.resolve(onComplete?.()).finally(() => setPct(0));
    } else {
      setPct(0);
    }
  }

  return /*#__PURE__*/ _jsx('div', {
    className: `stp-swipe${disabled ? ' is-disabled' : ''}`,
    children: /*#__PURE__*/ _jsxs('div', {
      className: 'stp-swipe__track',
      ref: trackRef,
      onPointerDown: (e) => {
        if (disabled) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      },
      onPointerMove: (e) => {
        if (!dragging.current || disabled) return;
        setFromClientX(e.clientX);
      },
      onPointerUp: endDrag,
      onPointerCancel: () => {
        dragging.current = false;
        setPct(0);
      },
      children: [
        /*#__PURE__*/ _jsx('div', {
          className: 'stp-swipe__fill',
          style: { width: `${pct}%` },
        }),
        /*#__PURE__*/ _jsx('div', {
          className: 'stp-swipe__knob',
          style: { left: `min(calc(${pct}% - 1.1rem), calc(100% - 2.2rem))` },
          children: '≫',
        }),
        /*#__PURE__*/ _jsx('span', {
          className: 'stp-swipe__label',
          children: label,
        }),
      ],
    }),
  });
}

export default function StpProcessMonitor({
  lot,
  stages = [],
  displayStatus = 'IDLE',
  isWritable = true,
  busy = false,
  openStoppage = null,
  canStart = false,
  canEnd = false,
  onGoOrders,
  onOpenStoppage,
  onEndStoppage,
  onOpenBath,
  onStart,
  onEnd,
  onAdvance,
  onSaveReading,
  productionBlock = null,
  emptyTitle = 'Production run',
  emptyHint = 'Select a production run from Order or History, then swipe to Start.',
}) {
  const activeStage = useMemo(
    () => stages.find((s) => s.status === 'ACTIVE') ?? null,
    [stages]
  );
  const [selectedCode, setSelectedCode] = useState(null);
  const [draft, setDraft] = useState({});
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const draftRef = useRef(draft);
  const remarksRef = useRef(remarks);
  const selectedDefRef = useRef(null);
  const skipNextAutosave = useRef(false);

  useTick(!!activeStage?.startedAt && displayStatus !== 'STOPPAGE');

  const selectedDef =
    STP_MONITOR_STAGES.find((s) => s.id === (selectedCode || activeStage?.stageCode || 'DEGREASE')) ??
    STP_MONITOR_STAGES[0];
  selectedDefRef.current = selectedDef;

  const selectedRow = stages.find((s) => s.stageCode === selectedDef.id) ?? null;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    remarksRef.current = remarks;
  }, [remarks]);

  useEffect(() => {
    if (activeStage?.stageCode) setSelectedCode(activeStage.stageCode);
  }, [activeStage?.stageCode, lot?.id]);

  useEffect(() => {
    if (!lot) {
      setDraft({});
      setRemarks('');
      return;
    }
    skipNextAutosave.current = true;
    const next = {};
    for (const [k] of selectedDef.fields) next[k] = lot[k] ?? '';
    setDraft(next);
    setRemarks(lot.remarks ?? '');
  }, [
    lot?.id,
    selectedDef.id,
    lot?.degreaseTempC,
    lot?.degreaseTimeMin,
    lot?.descaleTimeMin,
    lot?.phosphateTempC,
    lot?.phosphateTimeMin,
    lot?.neutTempC,
    lot?.neutralizerTimeMin,
    lot?.lubeTempC,
    lot?.lubeTimeMin,
    lot?.dryerTempC,
    lot?.dryerTimeMin,
    lot?.reactiveOilTimeMin,
    lot?.sfNeutTempC,
    lot?.remarks,
  ]);

  const doneCount = stages.filter((s) => s.status === 'COMPLETE' || s.status === 'NA').length;
  const totalCount = stages.length || STP_MONITOR_STAGES.length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const nextPending = useMemo(() => {
    const ordered = [...stages].sort((a, b) => a.sortOrd - b.sortOrd);
    const idx = ordered.findIndex((s) => s.status === 'ACTIVE');
    if (idx < 0) return ordered.find((s) => s.status === 'PENDING') ?? null;
    return ordered.slice(idx + 1).find((s) => s.status === 'PENDING') ?? null;
  }, [stages]);

  const canAdvance =
    isWritable &&
    !!lot?.productionStartedAt &&
    !lot?.productionEndedAt &&
    displayStatus === 'RUNNING' &&
    !!activeStage &&
    !busy;

  const swipeMode = canStart ? 'start' : canAdvance ? 'advance' : canEnd ? 'end' : 'idle';
  const swipeEnabled = (swipeMode === 'start' || swipeMode === 'advance' || swipeMode === 'end') && !busy;
  const swipeLabel =
    swipeMode === 'start'
      ? 'SWIPE — START'
      : swipeMode === 'advance'
        ? `SWIPE — NEXT: ${
            STP_MONITOR_STAGES.find((s) => s.id === nextPending?.stageCode)?.label ||
            (activeStage ? 'COMPLETE' : '—')
          }`
        : swipeMode === 'end'
          ? 'SWIPE — END'
          : displayStatus === 'STOPPAGE'
            ? 'END STOPPAGE FIRST'
            : 'SWIPE UNAVAILABLE';

  const elapsed =
    selectedRow?.status === 'ACTIVE' && selectedRow.startedAt
      ? formatElapsed(selectedRow.startedAt)
      : selectedRow?.durationMin != null
        ? `${Number(selectedRow.durationMin).toFixed(1)} min`
        : activeStage?.startedAt
          ? formatElapsed(activeStage.startedAt)
          : '—';

  function buildPatch() {
    const def = selectedDefRef.current;
    const patch = { remarks: remarksRef.current || undefined };
    if (def) {
      for (const [k] of def.fields) patch[k] = numOrUndef(draftRef.current[k]);
    }
    return patch;
  }

  async function flushAutosave() {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!lot || !isWritable || lot.status === 'APPROVED' || !onSaveReading) return;
    setSaving(true);
    try {
      await onSaveReading(buildPatch());
    } finally {
      setSaving(false);
    }
  }

  function scheduleAutosave() {
    if (!lot || !isWritable || lot.status === 'APPROVED') return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        setErr('');
        try {
          await onSaveReading?.(buildPatch());
          setMsg('Saved');
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Auto-save failed');
        } finally {
          setSaving(false);
        }
      })();
    }, 600);
  }

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  function updateDraft(key, value) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      draftRef.current = next;
      return next;
    });
    scheduleAutosave();
  }

  function updateRemarks(value) {
    remarksRef.current = value;
    setRemarks(value);
    scheduleAutosave();
  }

  async function handleSwipe() {
    setErr('');
    setMsg('');
    try {
      await flushAutosave();
      if (swipeMode === 'start') {
        await onStart?.();
        setMsg('Production started');
      } else if (swipeMode === 'advance') {
        await onAdvance?.();
        setMsg('Stage advanced');
      } else if (swipeMode === 'end') {
        await onEnd?.();
        setMsg('Production ended');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed');
      throw e;
    }
  }

  if (!lot) {
    return /*#__PURE__*/ _jsxs('div', {
      className: 'stp-run-console stp-run-console--empty',
      children: [
        /*#__PURE__*/ _jsx('h2', { children: emptyTitle }),
        /*#__PURE__*/ _jsx('p', { className: 'empty-hint', children: emptyHint }),
        /*#__PURE__*/ _jsx(ZButton, {
          variant: 'primary',
          onClick: onGoOrders,
          children: 'Go to Orders',
        }),
      ],
    });
  }

  const woLabel = `${lot.workOrderNo || '—'} · LINE ${lot.workOrderLineNo ?? '—'}`;
  const fieldsEditable = isWritable && lot.status !== 'APPROVED';

  return /*#__PURE__*/ _jsxs('div', {
    className: 'stp-run-console',
    children: [
      /*#__PURE__*/ _jsxs('header', {
        className: 'stp-run-console__header',
        children: [
          /*#__PURE__*/ _jsxs('div', {
            className: 'stp-run-console__title-row',
            children: [
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-run-console__identity',
                children: [
                  /*#__PURE__*/ _jsx('button', {
                    type: 'button',
                    className: 'stp-run-console__back',
                    onClick: onGoOrders,
                    'aria-label': 'Back to orders',
                    children: '←',
                  }),
                  /*#__PURE__*/ _jsx('h1', { children: woLabel }),
                  /*#__PURE__*/ _jsx(ZBadge, { tone: 'idle', children: 'STP' }),
                  /*#__PURE__*/ _jsx(ZBadge, {
                    tone: statusTone(displayStatus === 'COMPLETE' ? 'COMPLETED' : displayStatus),
                    pulse: displayStatus === 'RUNNING' || displayStatus === 'STOPPAGE',
                    children: displayStatus,
                  }),
                  saving
                    ? /*#__PURE__*/ _jsx(ZBadge, { tone: 'idle', children: 'Saving…' })
                    : null,
                ],
              }),
            ],
          }),
          /*#__PURE__*/ _jsxs('div', {
            className: 'stp-run-console__progress',
            children: [
              /*#__PURE__*/ _jsx('div', {
                className: 'stp-run-console__progress-bar',
                children: /*#__PURE__*/ _jsx('div', {
                  style: { width: `${progressPct}%` },
                }),
              }),
              /*#__PURE__*/ _jsxs('span', {
                children: [progressPct, '% · ', doneCount, ' / ', totalCount],
              }),
            ],
          }),
        ],
      }),

      productionBlock,

      /*#__PURE__*/ _jsx('div', {
        className: 'stp-run-console__timeline-wrap',
        children: /*#__PURE__*/ _jsx('ol', {
          className: 'stp-run-console__timeline',
          children: STP_MONITOR_STAGES.map((def, i) => {
            const row = stages.find((s) => s.stageCode === def.id);
            const st = row?.status || (def.fields.length ? 'PENDING' : 'NA');
            const isSel = selectedDef.id === def.id;
            const isNow = st === 'ACTIVE';
            return /*#__PURE__*/ _jsxs(
              'li',
              {
                className: `stp-run-console__node is-${st.toLowerCase()}${isSel ? ' is-selected' : ''}${isNow ? ' is-now' : ''}`,
                children: [
                  i > 0
                    ? /*#__PURE__*/ _jsx('span', {
                        className: `stp-run-console__connector${
                          st === 'COMPLETE' || st === 'ACTIVE' || st === 'NA' ? ' is-hot' : ''
                        }`,
                      })
                    : null,
                  /*#__PURE__*/ _jsxs('button', {
                    type: 'button',
                    className: 'stp-run-console__node-btn',
                    onClick: () => setSelectedCode(def.id),
                    children: [
                      /*#__PURE__*/ _jsx('span', {
                        className: 'stp-run-console__node-circle',
                        children: st === 'COMPLETE' ? '✓' : st === 'NA' ? '—' : i + 1,
                      }),
                      /*#__PURE__*/ _jsx('span', {
                        className: 'stp-run-console__node-label',
                        children: def.label,
                      }),
                      isNow
                        ? /*#__PURE__*/ _jsx('span', {
                            className: 'stp-run-console__now',
                            children: 'NOW',
                          })
                        : null,
                      isNow && row?.startedAt
                        ? /*#__PURE__*/ _jsx('span', {
                            className: 'stp-run-console__node-elapsed',
                            children: formatElapsed(row.startedAt),
                          })
                        : row?.durationMin != null
                          ? /*#__PURE__*/ _jsx('span', {
                              className: 'stp-run-console__node-elapsed',
                              children: `${Number(row.durationMin).toFixed(1)}m`,
                            })
                          : null,
                    ],
                  }),
                ],
              },
              def.id
            );
          }),
        }),
      }),

      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-run-console__body',
        children: [
          /*#__PURE__*/ _jsxs('section', {
            className: 'stp-run-console__readings',
            children: [
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-run-console__readings-head',
                children: [
                  /*#__PURE__*/ _jsxs('div', {
                    children: [
                      /*#__PURE__*/ _jsx('h2', { children: selectedDef.label }),
                      /*#__PURE__*/ _jsxs('p', {
                        className: 'muted',
                        children: ['Target: ', selectedDef.target],
                      }),
                    ],
                  }),
                  /*#__PURE__*/ _jsxs('div', {
                    className: 'stp-run-console__readings-meta',
                    children: [
                      /*#__PURE__*/ _jsx(ZBadge, { tone: 'idle', children: 'Source: MANUAL' }),
                      /*#__PURE__*/ _jsxs('span', {
                        className: 'muted',
                        children: ['Elapsed ', elapsed],
                      }),
                    ],
                  }),
                ],
              }),
              !selectedDef.fields.length
                ? /*#__PURE__*/ _jsxs('div', {
                    className: 'stp-run-console__na',
                    children: [
                      /*#__PURE__*/ _jsx('p', {
                        children: selectedDef.naHint || 'No MANUAL process fields for this stage.',
                      }),
                      /*#__PURE__*/ _jsx(ZButton, {
                        variant: 'primary',
                        onClick: onOpenBath,
                        children: 'Open Bath Analysis',
                      }),
                    ],
                  })
                : /*#__PURE__*/ _jsx('div', {
                    className: 'stp-run-console__grid',
                    children: selectedDef.fields.map(([key, label, unit]) =>
                      /*#__PURE__*/ _jsxs(
                        'label',
                        {
                          className: 'stp-run-console__field',
                          children: [
                            /*#__PURE__*/ _jsxs('span', {
                              children: [label, unit ? ` (${unit})` : ''],
                            }),
                            /*#__PURE__*/ _jsx(ZInput, {
                              type: 'number',
                              step: 'any',
                              disabled: !fieldsEditable,
                              value: draft[key] ?? '',
                              onChange: (e) => updateDraft(key, e.target.value),
                            }),
                          ],
                        },
                        key
                      )
                    ),
                  }),
              /*#__PURE__*/ _jsxs('label', {
                className: 'stp-run-console__remarks',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Remarks' }),
                  /*#__PURE__*/ _jsx(ZInput, {
                    disabled: !fieldsEditable,
                    value: remarks,
                    onChange: (e) => updateRemarks(e.target.value),
                  }),
                ],
              }),
              msg ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--ok', children: msg }) : null,
              err
                ? /*#__PURE__*/ _jsx('p', { className: 'banner banner--error', children: err })
                : null,
            ],
          }),

          /*#__PURE__*/ _jsxs('aside', {
            className: 'stp-run-console__actions',
            children: [
              /*#__PURE__*/ _jsx(SwipeControl, {
                disabled: !swipeEnabled,
                label: swipeLabel,
                onComplete: handleSwipe,
              }),
              canEnd && swipeMode !== 'end'
                ? /*#__PURE__*/ _jsx(ZButton, {
                    variant: 'primary',
                    disabled: busy || !isWritable,
                    onClick: async () => {
                      setErr('');
                      try {
                        await flushAutosave();
                        await onEnd?.();
                        setMsg('Production ended');
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : 'End failed');
                      }
                    },
                    children: 'End production',
                  })
                : null,
              openStoppage
                ? /*#__PURE__*/ _jsx(ZButton, {
                    className: 'stp-run-console__stoppage',
                    onClick: onEndStoppage,
                    children: 'END STOPPAGE',
                  })
                : /*#__PURE__*/ _jsx(ZButton, {
                    className: 'stp-run-console__stoppage',
                    disabled: displayStatus !== 'RUNNING' || !isWritable,
                    onClick: onOpenStoppage,
                    children: 'OPEN STOPPAGE',
                  }),
            ],
          }),
        ],
      }),
    ],
  });
}
