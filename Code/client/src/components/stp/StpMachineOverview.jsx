import { useQuery } from '@tanstack/react-query';
import { stpApi } from '../../api/processApi';
import { ZBadge, ZButton, statusTone } from '../../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

function fmtMt(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

function clockLabel(lot) {
  if (!lot) return null;
  if (lot.productionEndedAt) return 'COMPLETE';
  if (lot.productionStartedAt) return 'RUNNING';
  return 'IDLE';
}

function NextCard({ item }) {
  return /*#__PURE__*/ _jsxs('div', {
    className: 'stp-overview__next-grid',
    children: [
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-overview__kv',
        children: [
          /*#__PURE__*/ _jsx('span', { children: 'Order' }),
          /*#__PURE__*/ _jsxs('strong', {
            children: [item.workOrderNo, item.lineNo != null ? ` · L${item.lineNo}` : ''],
          }),
        ],
      }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-overview__kv',
        children: [
          /*#__PURE__*/ _jsx('span', { children: 'Product' }),
          /*#__PURE__*/ _jsxs('strong', {
            children: [item.gradeCode || '—', ' · STP'],
          }),
        ],
      }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-overview__kv',
        children: [
          /*#__PURE__*/ _jsx('span', { children: 'Customer' }),
          /*#__PURE__*/ _jsx('strong', { children: item.customerCode || '—' }),
        ],
      }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-overview__kv',
        children: [
          /*#__PURE__*/ _jsx('span', { children: 'Planned quantity' }),
          /*#__PURE__*/ _jsxs('strong', {
            children: [fmtMt(item.plannedQty), ' MT'],
          }),
        ],
      }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-overview__kv',
        children: [
          /*#__PURE__*/ _jsx('span', { children: 'Queue position' }),
          /*#__PURE__*/ _jsx('strong', { children: item.queuePosition ?? 1 }),
        ],
      }),
    ],
  });
}

export default function StpMachineOverview({
  selectedLot = null,
  onGoOrders,
  onOpenMonitoring,
  onOpenProduction,
  onSelectUpcoming,
}) {
  const liveQ = useQuery({
    queryKey: ['stp-live-status'],
    queryFn: () => stpApi.liveStatus(),
    refetchInterval: 5000,
  });

  const data = liveQ.data ?? {};
  const summary = data.shiftSummary ?? {};
  const current = data.current ?? null;
  const upcoming = Array.isArray(data.upcoming) ? data.upcoming : [];
  const displayLot =
    current ||
    (selectedLot && !selectedLot.productionEndedAt ? selectedLot : null);
  const status = clockLabel(displayLot);
  const next = upcoming[0] ?? null;
  const rest = upcoming.slice(1);
  const productionLotId = displayLot?.id ?? selectedLot?.id ?? null;

  return /*#__PURE__*/ _jsxs('div', {
    className: 'stp-overview',
    children: [
      /*#__PURE__*/ _jsxs('header', {
        className: 'stp-overview__page-head',
        children: [
          /*#__PURE__*/ _jsx('div', {
            className: 'eyebrow',
            children: 'STP-01 · Live production status',
          }),
          /*#__PURE__*/ _jsx('h1', { children: 'Machine Overview' }),
        ],
      }),

      /*#__PURE__*/ _jsxs('section', {
        className: 'stp-overview__shift',
        children: [
          /*#__PURE__*/ _jsx('h2', { children: 'Shift Summary' }),
          /*#__PURE__*/ _jsxs('div', {
            className: 'stp-overview__kpis',
            children: [
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-overview__kpi',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Total prod MT' }),
                  /*#__PURE__*/ _jsx('strong', { children: fmtMt(summary.totalProdMt) }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-overview__kpi',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Completed MT' }),
                  /*#__PURE__*/ _jsx('strong', { children: fmtMt(summary.completedMt) }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-overview__kpi',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Running' }),
                  /*#__PURE__*/ _jsx('strong', { children: summary.runningCount ?? 0 }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-overview__kpi',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Bath analyses' }),
                  /*#__PURE__*/ _jsx('strong', { children: summary.bathAnalyses ?? 0 }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-overview__kpi',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Chem additions' }),
                  /*#__PURE__*/ _jsx('strong', { children: summary.chemicalAdditions ?? 0 }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                className: 'stp-overview__kpi',
                children: [
                  /*#__PURE__*/ _jsx('span', { children: 'Stoppage' }),
                  /*#__PURE__*/ _jsxs('strong', {
                    children: [summary.stoppageMin ?? 0, ' min'],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-overview__split',
        children: [
          /*#__PURE__*/ _jsxs('section', {
            className: 'stp-overview__panel stp-overview__panel--primary',
            children: [
              /*#__PURE__*/ _jsxs('header', {
                className: 'stp-overview__panel-head',
                children: [
                  /*#__PURE__*/ _jsx('h2', { children: 'Current Running Order' }),
                  status
                    ? /*#__PURE__*/ _jsx(ZBadge, {
                        tone: statusTone(status === 'COMPLETE' ? 'COMPLETED' : status),
                        pulse: status === 'RUNNING',
                        children: status,
                      })
                    : null,
                ],
              }),
              displayLot
                ? /*#__PURE__*/ _jsxs('div', {
                    className: 'stp-overview__current',
                    children: [
                      /*#__PURE__*/ _jsxs('div', {
                        className: 'stp-overview__next-grid',
                        children: [
                          /*#__PURE__*/ _jsxs('div', {
                            className: 'stp-overview__kv',
                            children: [
                              /*#__PURE__*/ _jsx('span', { children: 'Work order' }),
                              /*#__PURE__*/ _jsxs('strong', {
                                children: [
                                  displayLot.workOrderNo || '—',
                                  displayLot.workOrderLineNo != null
                                    ? ` · L${displayLot.workOrderLineNo}`
                                    : '',
                                ],
                              }),
                            ],
                          }),
                          /*#__PURE__*/ _jsxs('div', {
                            className: 'stp-overview__kv',
                            children: [
                              /*#__PURE__*/ _jsx('span', { children: 'Lot' }),
                              /*#__PURE__*/ _jsx('strong', { children: displayLot.lotNo || '—' }),
                            ],
                          }),
                          /*#__PURE__*/ _jsxs('div', {
                            className: 'stp-overview__kv',
                            children: [
                              /*#__PURE__*/ _jsx('span', { children: 'Customer' }),
                              /*#__PURE__*/ _jsx('strong', {
                                children: displayLot.customerCode || '—',
                              }),
                            ],
                          }),
                          /*#__PURE__*/ _jsxs('div', {
                            className: 'stp-overview__kv',
                            children: [
                              /*#__PURE__*/ _jsx('span', { children: 'Grade' }),
                              /*#__PURE__*/ _jsx('strong', {
                                children: displayLot.gradeCode || '—',
                              }),
                            ],
                          }),
                          /*#__PURE__*/ _jsxs('div', {
                            className: 'stp-overview__kv',
                            children: [
                              /*#__PURE__*/ _jsx('span', { children: 'Qty (MT)' }),
                              /*#__PURE__*/ _jsx('strong', {
                                children: fmtMt(displayLot.qtyMt),
                              }),
                            ],
                          }),
                          /*#__PURE__*/ _jsxs('div', {
                            className: 'stp-overview__kv',
                            children: [
                              /*#__PURE__*/ _jsx('span', { children: 'Qty (NOS)' }),
                              /*#__PURE__*/ _jsx('strong', {
                                children: displayLot.qtyNo ?? '—',
                              }),
                            ],
                          }),
                        ],
                      }),
                      /*#__PURE__*/ _jsxs('div', {
                        className: 'stp-overview__actions',
                        children: [
                          /*#__PURE__*/ _jsx(ZButton, {
                            variant: 'primary',
                            onClick: () => onOpenProduction?.(displayLot.id),
                            children: 'Open Production',
                          }),
                          /*#__PURE__*/ _jsx(ZButton, {
                            onClick: () => onOpenMonitoring?.(displayLot.id),
                            children: 'Open Bath & Chemical',
                          }),
                        ],
                      }),
                    ],
                  })
                : /*#__PURE__*/ _jsxs('div', {
                    className: 'stp-overview__empty',
                    children: [
                      /*#__PURE__*/ _jsx('p', {
                        className: 'stp-overview__empty-title',
                        children: selectedLot && !selectedLot.productionEndedAt
                          ? 'Workorder assigned — not in console'
                          : next
                            ? 'Order preparing — not started'
                            : 'No running order',
                      }),
                      /*#__PURE__*/ _jsx('p', {
                        className: 'muted',
                        children: selectedLot && !selectedLot.productionEndedAt
                          ? `${selectedLot.workOrderNo || 'Lot'} is assigned. Open Production to run the console.`
                          : next
                            ? `${next.workOrderNo}${
                                next.lineNo != null ? ` L${next.lineNo}` : ''
                              } is ready in queue (pos ${next.queuePosition ?? 1}). Assign from Workorder, then open Production.`
                            : 'Select a workorder line from Workorder to prepare the next STP run.',
                      }),
                      productionLotId
                        ? /*#__PURE__*/ _jsx(ZButton, {
                            variant: 'primary',
                            onClick: () => onOpenProduction?.(productionLotId),
                            children: 'Open Production',
                          })
                        : /*#__PURE__*/ _jsx(ZButton, {
                            variant: 'primary',
                            onClick: onGoOrders,
                            children: '→ Go to Workorder',
                          }),
                    ],
                  }),
            ],
          }),

          /*#__PURE__*/ _jsxs('section', {
            className: 'stp-overview__panel',
            children: [
              /*#__PURE__*/ _jsxs('header', {
                className: 'stp-overview__panel-head',
                children: [
                  /*#__PURE__*/ _jsx('h2', { children: 'Upcoming Queue' }),
                  /*#__PURE__*/ _jsxs(ZBadge, {
                    tone: 'idle',
                    children: [upcoming.length, ' orders'],
                  }),
                ],
              }),
              next
                ? /*#__PURE__*/ _jsxs('div', {
                    className: 'stp-overview__queue',
                    children: [
                      /*#__PURE__*/ _jsx(NextCard, { item: next }),
                      /*#__PURE__*/ _jsx(ZButton, {
                        onClick: () => onSelectUpcoming?.(next),
                        children: 'Open in Workorder',
                      }),
                      rest.length
                        ? /*#__PURE__*/ _jsx('ul', {
                            className: 'stp-overview__queue-list',
                            children: rest.map((u) =>
                              /*#__PURE__*/ _jsxs(
                                'li',
                                {
                                  children: [
                                    /*#__PURE__*/ _jsxs('button', {
                                      type: 'button',
                                      className: 'stp-overview__queue-item',
                                      onClick: () => onSelectUpcoming?.(u),
                                      children: [
                                        /*#__PURE__*/ _jsxs('strong', {
                                          children: [
                                            u.workOrderNo,
                                            u.lineNo != null ? ` L${u.lineNo}` : '',
                                          ],
                                        }),
                                        /*#__PURE__*/ _jsxs('span', {
                                          children: [
                                            u.gradeCode || '—',
                                            ' · ',
                                            fmtMt(u.plannedQty),
                                            ' MT',
                                          ],
                                        }),
                                        /*#__PURE__*/ _jsxs('em', {
                                          children: ['Pos ', u.queuePosition],
                                        }),
                                      ],
                                    }),
                                  ],
                                },
                                `${u.workOrderNo}-${u.lineNo}`
                              )
                            ),
                          })
                        : null,
                    ],
                  })
                : /*#__PURE__*/ _jsx('p', {
                    className: 'muted',
                    children: 'Queue is empty.',
                  }),
            ],
          }),
        ],
      }),

      liveQ.isError
        ? /*#__PURE__*/ _jsx('p', {
            className: 'banner banner--error',
            children: liveQ.error instanceof Error ? liveQ.error.message : 'Live status failed',
          })
        : null,
    ],
  });
}
