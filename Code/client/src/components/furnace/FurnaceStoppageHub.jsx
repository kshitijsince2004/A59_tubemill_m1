import { useQuery, useQueryClient } from '@tanstack/react-query';
import { furnaceApi } from '../../api/processApi';
import { stoppageApi } from '../../api/plantApi';
import { ZButton, ZBadge, ZPageHeader, statusTone } from '../../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

/**
 * Cross-furnace open stoppages (ANN Stop hub analogue).
 * Start new stoppages from Capture; end them here or on capture.
 */
export default function FurnaceStoppageHub({ onOpenLot }) {
  const qc = useQueryClient();
  const { data: rows = [], isFetching, refetch, error } = useQuery({
    queryKey: ['furnace-open-stoppages'],
    queryFn: () => furnaceApi.openStoppages(),
    refetchInterval: 30_000,
  });

  async function endStoppage(row) {
    if (!row.sourceId) return;
    await stoppageApi.close('FUR', row.sourceId);
    await qc.invalidateQueries({ queryKey: ['furnace-open-stoppages'] });
    await qc.invalidateQueries({ queryKey: ['furnace-board'] });
    await qc.invalidateQueries({ queryKey: ['process-stoppages'] });
  }

  return /*#__PURE__*/ _jsxs('div', {
    className: 'furnace-stop-hub',
    children: [
      /*#__PURE__*/ _jsx(ZPageHeader, {
        title: 'Furnace stoppages',
        subtitle: 'Open downtime across RHF-03/04/05 — start new stoppages from Capture',
        actions: /*#__PURE__*/ _jsx(ZButton, {
          variant: 'ghost',
          disabled: isFetching,
          onClick: () => void refetch(),
          children: isFetching ? 'Refreshing…' : 'Refresh',
        }),
      }),
      error
        ? /*#__PURE__*/ _jsx('p', {
            className: 'banner banner--error',
            children: error instanceof Error ? error.message : 'Load failed',
          })
        : null,
      /*#__PURE__*/ _jsxs('table', {
        className: 'furnace-hist-table',
        children: [
          /*#__PURE__*/ _jsx('thead', {
            children: /*#__PURE__*/ _jsxs('tr', {
              children: [
                /*#__PURE__*/ _jsx('th', { children: 'Furnace' }),
                /*#__PURE__*/ _jsx('th', { children: 'Run' }),
                /*#__PURE__*/ _jsx('th', { children: 'WO' }),
                /*#__PURE__*/ _jsx('th', { children: 'Code' }),
                /*#__PURE__*/ _jsx('th', { children: 'Since' }),
                /*#__PURE__*/ _jsx('th', { children: 'Reason' }),
                /*#__PURE__*/ _jsx('th', { children: '' }),
              ],
            }),
          }),
          /*#__PURE__*/ _jsx('tbody', {
            children: rows.length
              ? rows.map((r) =>
                  /*#__PURE__*/ _jsxs(
                    'tr',
                    {
                      children: [
                        /*#__PURE__*/ _jsx('td', {
                          className: 'font-mono',
                          children: r.furnaceCode || '—',
                        }),
                        /*#__PURE__*/ _jsx('td', {
                          className: 'font-mono',
                          children: r.chargeNo || '—',
                        }),
                        /*#__PURE__*/ _jsx('td', {
                          className: 'font-mono',
                          children: r.workOrderNo || '—',
                        }),
                        /*#__PURE__*/ _jsx('td', {
                          children: /*#__PURE__*/ _jsx(ZBadge, {
                            tone: statusTone('STOPPAGE'),
                            children: r.stoppageCode || 'STOP',
                          }),
                        }),
                        /*#__PURE__*/ _jsx('td', {
                          children: r.fromTime ? String(r.fromTime).replace('T', ' ').slice(0, 19) : '—',
                        }),
                        /*#__PURE__*/ _jsx('td', { children: r.reason || '—' }),
                        /*#__PURE__*/ _jsxs('td', {
                          className: 'furnace-hist-table__actions',
                          children: [
                            /*#__PURE__*/ _jsx(ZButton, {
                              variant: 'ghost',
                              onClick: () => onOpenLot?.(r),
                              children: 'Open',
                            }),
                            /*#__PURE__*/ _jsx(ZButton, {
                              variant: 'primary',
                              onClick: () => void endStoppage(r).catch(() => undefined),
                              children: 'End',
                            }),
                          ],
                        }),
                      ],
                    },
                    String(r.id)
                  )
                )
              : /*#__PURE__*/ _jsx('tr', {
                  children: /*#__PURE__*/ _jsx('td', {
                    colSpan: 7,
                    className: 'empty-hint',
                    children: 'No open furnace stoppages.',
                  }),
                }),
          }),
        ],
      }),
    ],
  });
}
