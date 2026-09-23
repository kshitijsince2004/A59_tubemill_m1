import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { furnaceApi } from '../../api/processApi';
import { ErpWoSelect } from '../ErpWoSelect';
import { ZButton, ZFilterPills, ZPageHeader } from '../../ui';
import FurnaceCard from './FurnaceCard';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'RUNNING', label: 'Running' },
  { id: 'STOPPAGE', label: 'Stoppage' },
  { id: 'PREPARING', label: 'Preparing' },
  { id: 'COMPLETE', label: 'Complete' },
  { id: 'IDLE', label: 'Idle' },
];

export default function FurnaceBoard({ onOpenFurnace, onAssigned }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('ALL');
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignWo, setAssignWo] = useState('');
  const [assignErr, setAssignErr] = useState('');
  const [assigning, setAssigning] = useState(false);

  const { data: rows = [], isFetching, refetch, error } = useQuery({
    queryKey: ['furnace-board'],
    queryFn: () => furnaceApi.board(),
    refetchInterval: 30_000,
  });

  const counts = useMemo(() => {
    const c = { ALL: rows.length };
    for (const r of rows) {
      const s = String(r.status ?? 'IDLE');
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((r) => String(r.status) === filter);
  }, [rows, filter]);

  const pills = FILTERS.map((p) => ({
    ...p,
    count: p.id === 'ALL' ? counts.ALL : counts[p.id] ?? 0,
  }));

  async function confirmAssign() {
    if (!assignTarget || !assignWo) return;
    setAssigning(true);
    setAssignErr('');
    try {
      const lot = await furnaceApi.assign(assignTarget.furnaceCode, {
        workOrderNo: assignWo,
      });
      setAssignTarget(null);
      setAssignWo('');
      await qc.invalidateQueries({ queryKey: ['furnace-board'] });
      await qc.invalidateQueries({ queryKey: ['furnace-lots'] });
      onAssigned?.(lot, assignTarget.furnaceCode);
    } catch (e) {
      setAssignErr(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssigning(false);
    }
  }

  return /*#__PURE__*/ _jsxs('div', {
    className: 'furnace-board',
    children: [
      /*#__PURE__*/ _jsx(ZPageHeader, {
        title: 'Furnace board',
        subtitle: 'RHF floor — open a furnace or assign a released WO',
        actions: /*#__PURE__*/ _jsx(ZButton, {
          variant: 'ghost',
          disabled: isFetching,
          onClick: () => void refetch(),
          children: isFetching ? 'Refreshing…' : 'Refresh',
        }),
      }),

      /*#__PURE__*/ _jsx(ZFilterPills, {
        pills,
        value: filter,
        onChange: setFilter,
      }),

      error
        ? /*#__PURE__*/ _jsx('p', {
            className: 'banner banner--error',
            children: error instanceof Error ? error.message : 'Board load failed',
          })
        : null,

      /*#__PURE__*/ _jsx('div', {
        className: 'furnace-board__grid',
        children: filtered.map((row) =>
          /*#__PURE__*/ _jsx(
            FurnaceCard,
            {
              row,
              assigning: assigning && assignTarget?.furnaceCode === row.furnaceCode,
              onOpen: (r) => onOpenFurnace?.(r),
              onAssign: (r) => {
                setAssignTarget(r);
                setAssignWo('');
                setAssignErr('');
              },
            },
            row.furnaceCode
          )
        ),
      }),

      !filtered.length
        ? /*#__PURE__*/ _jsx('p', {
            className: 'empty-hint',
            children: 'No furnaces match this filter.',
          })
        : null,

      assignTarget
        ? /*#__PURE__*/ _jsxs('div', {
            className: 'furnace-assign-dialog',
            role: 'dialog',
            'aria-label': `Assign order to ${assignTarget.furnaceCode}`,
            children: [
              /*#__PURE__*/ _jsxs('div', {
                className: 'furnace-assign-dialog__panel',
                children: [
                  /*#__PURE__*/ _jsx('h3', {
                    children: `Assign order → ${assignTarget.furnaceCode}`,
                  }),
                  /*#__PURE__*/ _jsx('p', {
                    className: 'muted',
                    children: 'Creates a DRAFT production run on this furnace from a released ERP work order.',
                  }),
                  /*#__PURE__*/ _jsxs('label', {
                    children: [
                      'Work order',
                      /*#__PURE__*/ _jsx(ErpWoSelect, {
                        value: assignWo,
                        onChange: (wo) => setAssignWo(wo),
                      }),
                    ],
                  }),
                  assignErr
                    ? /*#__PURE__*/ _jsx('p', {
                        className: 'banner banner--error',
                        children: assignErr,
                      })
                    : null,
                  /*#__PURE__*/ _jsxs('div', {
                    className: 'btn-row',
                    children: [
                      /*#__PURE__*/ _jsx(ZButton, {
                        variant: 'ghost',
                        disabled: assigning,
                        onClick: () => setAssignTarget(null),
                        children: 'Cancel',
                      }),
                      /*#__PURE__*/ _jsx(ZButton, {
                        variant: 'primary',
                        disabled: assigning || !assignWo,
                        onClick: () => void confirmAssign(),
                        children: assigning ? 'Assigning…' : 'Assign & open',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        : null,
    ],
  });
}
