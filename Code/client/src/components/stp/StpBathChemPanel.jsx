import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stpApi } from '../../api/processApi';
import { ZBadge, ZButton } from '../../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

const TABLE_TABS = [
  { id: 'bath', label: 'Bath recordings' },
  { id: 'chem', label: 'Chemical recordings' },
];

/** Matches server currentShiftRef(): A 06–14, B 14–22, C 22–06 */
function currentShiftWindow(now = new Date()) {
  const hour = now.getHours();
  let shiftRef = 'C';
  if (hour >= 6 && hour < 14) shiftRef = 'A';
  else if (hour >= 14 && hour < 22) shiftRef = 'B';

  const start = new Date(now);
  const end = new Date(now);
  start.setSeconds(0, 0);
  end.setSeconds(0, 0);

  if (shiftRef === 'A') {
    start.setHours(6, 0, 0, 0);
    end.setHours(14, 0, 0, 0);
  } else if (shiftRef === 'B') {
    start.setHours(14, 0, 0, 0);
    end.setHours(22, 0, 0, 0);
  } else if (hour >= 22) {
    start.setHours(22, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(6, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 1);
    start.setHours(22, 0, 0, 0);
    end.setHours(6, 0, 0, 0);
  }

  return { shiftRef, start, end };
}

function inShiftWindow(iso, start, end) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= start.getTime() && t < end.getTime();
}

function SubNav({ items, active, onChange }) {
  return /*#__PURE__*/ _jsx('div', {
    className: 'stp-subnav',
    role: 'tablist',
    children: items.map((item) =>
      /*#__PURE__*/ _jsx(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': active === item.id,
          className: `stp-subnav__btn${active === item.id ? ' is-active' : ''}`,
          onClick: () => onChange(item.id),
          children: item.label,
        },
        item.id
      )
    ),
  });
}

export default function StpBathChemPanel({
  isWritable = true,
  onOpenBath,
  onOpenChem,
}) {
  const [tableTab, setTableTab] = useState('bath');
  const shift = useMemo(() => currentShiftWindow(), []);

  const bathQ = useQuery({
    queryKey: ['stp-hist-bath', 'monitoring'],
    queryFn: () => stpApi.historyBathAnalysis({}),
    refetchInterval: 5000,
  });
  const chemQ = useQuery({
    queryKey: ['stp-hist-chem', 'monitoring'],
    queryFn: () => stpApi.historyChemical({}),
    refetchInterval: 5000,
  });

  const bathAll = Array.isArray(bathQ.data) ? bathQ.data : bathQ.data?.items ?? [];
  const chemAll = Array.isArray(chemQ.data) ? chemQ.data : chemQ.data?.items ?? [];

  const bathAnalyses = useMemo(
    () =>
      bathAll.filter((r) =>
        inShiftWindow(r.sampledAt || r.sampled_at, shift.start, shift.end)
      ),
    [bathAll, shift.start, shift.end]
  );
  const chemicalAdditions = useMemo(
    () => chemAll.filter((r) => inShiftWindow(r.createdAt, shift.start, shift.end)),
    [chemAll, shift.start, shift.end]
  );

  const bathTable = /*#__PURE__*/ _jsxs('section', {
    className: 'stp-bathchem-page__table-section',
    children: [
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-bathchem-page__table-head',
        children: [
          /*#__PURE__*/ _jsx('h3', { children: 'Bath analysis recordings' }),
          /*#__PURE__*/ _jsxs(ZBadge, {
            tone: 'idle',
            children: ['Shift ', shift.shiftRef, ' · current'],
          }),
        ],
      }),
      bathAnalyses.length
        ? /*#__PURE__*/ _jsx('div', {
            className: 'stp-bathchem-page__table-wrap',
            children: /*#__PURE__*/ _jsxs('table', {
              className: 'stp-run-console__records-table',
              children: [
                /*#__PURE__*/ _jsx('thead', {
                  children: /*#__PURE__*/ _jsxs('tr', {
                    children: [
                      /*#__PURE__*/ _jsx('th', { children: 'Time' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Deg TA' }),
                      /*#__PURE__*/ _jsx('th', { children: 'HCl %' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Fe %' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Act pH' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Phos TA' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Phos FA' }),
                      /*#__PURE__*/ _jsx('th', { children: 'ACC' }),
                      /*#__PURE__*/ _jsx('th', { children: 'OXTA' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Neut pH' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Lube Con' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Rinse pH' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Oil acid #' }),
                    ],
                  }),
                }),
                /*#__PURE__*/ _jsx('tbody', {
                  children: bathAnalyses.map((r, i) =>
                    /*#__PURE__*/ _jsxs(
                      'tr',
                      {
                        children: [
                          /*#__PURE__*/ _jsx('td', {
                            children: r.sampledAt || r.sampled_at
                              ? new Date(r.sampledAt || r.sampled_at).toLocaleString()
                              : '—',
                          }),
                          /*#__PURE__*/ _jsx('td', { children: r.degreaseTa ?? r.degrease_ta ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.hclPct ?? r.hcl_pct ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.fePct ?? r.fe_pct ?? '—' }),
                          /*#__PURE__*/ _jsx('td', {
                            children: r.activationPh ?? r.activation_ph ?? '—',
                          }),
                          /*#__PURE__*/ _jsx('td', { children: r.phosTa ?? r.phos_ta ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.phosFa ?? r.phos_fa ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.phosAcc ?? r.phos_acc ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.phosOxta ?? r.phos_oxta ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.neutPh ?? r.neut_ph ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.lubeCon ?? r.lube_con ?? '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.rinsePh ?? r.rinse_ph ?? '—' }),
                          /*#__PURE__*/ _jsx('td', {
                            children: r.oilWaterAcidNo ?? r.oil_water_acid_no ?? '—',
                          }),
                        ],
                      },
                      r.id || `bath-${i}`
                    )
                  ),
                }),
              ],
            }),
          })
        : /*#__PURE__*/ _jsx('p', {
            className: 'muted',
            children: 'No bath recordings in the current shift yet',
          }),
    ],
  });

  const chemTable = /*#__PURE__*/ _jsxs('section', {
    className: 'stp-bathchem-page__table-section',
    children: [
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-bathchem-page__table-head',
        children: [
          /*#__PURE__*/ _jsx('h3', { children: 'Chemical addition recordings' }),
          /*#__PURE__*/ _jsxs(ZBadge, {
            tone: 'idle',
            children: ['Shift ', shift.shiftRef, ' · current'],
          }),
        ],
      }),
      chemicalAdditions.length
        ? /*#__PURE__*/ _jsx('div', {
            className: 'stp-bathchem-page__table-wrap',
            children: /*#__PURE__*/ _jsxs('table', {
              className: 'stp-run-console__records-table',
              children: [
                /*#__PURE__*/ _jsx('thead', {
                  children: /*#__PURE__*/ _jsxs('tr', {
                    children: [
                      /*#__PURE__*/ _jsx('th', { children: 'Time' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Bath' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Chemical' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Qty' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Unit' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Batch' }),
                      /*#__PURE__*/ _jsx('th', { children: 'Remarks' }),
                    ],
                  }),
                }),
                /*#__PURE__*/ _jsx('tbody', {
                  children: chemicalAdditions.map((r, i) =>
                    /*#__PURE__*/ _jsxs(
                      'tr',
                      {
                        children: [
                          /*#__PURE__*/ _jsx('td', {
                            children: r.createdAt
                              ? new Date(r.createdAt).toLocaleString()
                              : '—',
                          }),
                          /*#__PURE__*/ _jsx('td', { children: r.bathCode || '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.chemical || '—' }),
                          /*#__PURE__*/ _jsx('td', {
                            children: r.quantity != null ? r.quantity : '—',
                          }),
                          /*#__PURE__*/ _jsx('td', { children: r.unit || '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.batchRef || '—' }),
                          /*#__PURE__*/ _jsx('td', { children: r.remarks || '—' }),
                        ],
                      },
                      r.id || `chem-${i}`
                    )
                  ),
                }),
              ],
            }),
          })
        : /*#__PURE__*/ _jsx('p', {
            className: 'muted',
            children: 'No chemical recordings in the current shift yet',
          }),
    ],
  });

  return /*#__PURE__*/ _jsxs('div', {
    className: 'stp-bathchem-page',
    children: [
      /*#__PURE__*/ _jsxs('header', {
        className: 'stp-bathchem-page__head',
        children: [
          /*#__PURE__*/ _jsx('h2', { children: 'Bath & Chemical' }),
          /*#__PURE__*/ _jsx('p', {
            className: 'muted',
            children:
              'Independent of work-order production — open a form to record, then review this shift\'s entries below.',
          }),
        ],
      }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'stp-bathchem-page__actions-row',
        children: [
          /*#__PURE__*/ _jsx(ZButton, {
            variant: 'primary',
            disabled: !isWritable,
            onClick: onOpenBath,
            children: 'Bath Analysis',
          }),
          /*#__PURE__*/ _jsx(ZButton, {
            variant: 'primary',
            disabled: !isWritable,
            onClick: onOpenChem,
            children: 'Chemical Addition',
          }),
        ],
      }),
      /*#__PURE__*/ _jsx(SubNav, {
        items: TABLE_TABS,
        active: tableTab,
        onChange: setTableTab,
      }),
      tableTab === 'bath' ? bathTable : chemTable,
    ],
  });
}
