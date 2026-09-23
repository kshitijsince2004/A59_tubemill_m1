import { ZBadge, ZButton, statusTone } from '../../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

function zoneBrief(zones) {
  if (!Array.isArray(zones) || !zones.length) return '—';
  const filled = zones.filter((z) => z.minC != null || z.maxC != null);
  if (!filled.length) return 'No zones yet';
  return filled
    .map((z) => `Z${z.zone}:${z.minC ?? '—'}/${z.maxC ?? '—'}`)
    .join(' · ');
}

function ageLabel(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

/**
 * ANN BaseCard-style furnace card — vertical status strip, RHF metrics (no stages).
 */
export default function FurnaceCard({
  row,
  onOpen,
  onAssign,
  assigning,
}) {
  const status = String(row.status ?? 'IDLE');
  const order = row.runningOrder;
  const idle = status === 'IDLE' || status === 'COMPLETE';
  const zonesFilled = row.zonesFilled ?? (row.zones || []).filter((z) => z.minC != null || z.maxC != null).length;
  const zonesTotal = row.zonesTotal ?? 6;
  const pct = Math.round((zonesFilled / zonesTotal) * 100);

  return /*#__PURE__*/ _jsxs('article', {
    className: `furnace-card furnace-card--ann furnace-card--${status.toLowerCase()}`,
    children: [
      /*#__PURE__*/ _jsx('div', {
        className: `furnace-card__vert furnace-card__vert--${status.toLowerCase()}`,
        children: /*#__PURE__*/ _jsx('span', { children: status }),
      }),
      /*#__PURE__*/ _jsxs('div', {
        className: 'furnace-card__body',
        children: [
          /*#__PURE__*/ _jsxs('header', {
            className: 'furnace-card__head',
            children: [
              /*#__PURE__*/ _jsxs('div', {
                children: [
                  /*#__PURE__*/ _jsx('h3', {
                    className: 'furnace-card__title',
                    children: row.furnaceCode,
                  }),
                  /*#__PURE__*/ _jsxs('p', {
                    className: 'furnace-card__label muted',
                    children: [
                      order?.workOrderNo || 'No WO',
                      ' · ',
                      row.chargeNo || '—',
                    ],
                  }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                className: 'furnace-card__badges',
                children: [
                  /*#__PURE__*/ _jsx(ZBadge, {
                    tone: statusTone(status === 'COMPLETE' ? 'COMPLETED' : status),
                    pulse: status === 'STOPPAGE' || status === 'RUNNING',
                    children: status,
                  }),
                  row.gasType
                    ? /*#__PURE__*/ _jsx(ZBadge, { tone: 'info', children: row.gasType })
                    : null,
                ],
              }),
            ],
          }),

          /*#__PURE__*/ _jsxs('div', {
            className: 'furnace-card__progress',
            children: [
              /*#__PURE__*/ _jsx('div', {
                className: 'furnace-card__progress-track',
                children: /*#__PURE__*/ _jsx('div', {
                  className: 'furnace-card__progress-fill',
                  style: { width: `${pct}%` },
                }),
              }),
              /*#__PURE__*/ _jsxs('span', {
                className: 'muted',
                children: ['Zones ', zonesFilled, '/', zonesTotal, ' · ', ageLabel(row.lastSavedAt)],
              }),
            ],
          }),

          /*#__PURE__*/ _jsxs('dl', {
            className: 'furnace-card__meta',
            children: [
              /*#__PURE__*/ _jsxs('div', {
                children: [
                  /*#__PURE__*/ _jsx('dt', { children: 'Customer' }),
                  /*#__PURE__*/ _jsx('dd', { children: order?.customerCode || '—' }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                children: [
                  /*#__PURE__*/ _jsx('dt', { children: 'Grade' }),
                  /*#__PURE__*/ _jsx('dd', { children: order?.gradeCode || '—' }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                children: [
                  /*#__PURE__*/ _jsx('dt', { children: 'Size' }),
                  /*#__PURE__*/ _jsx('dd', { children: order?.size || '—' }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                children: [
                  /*#__PURE__*/ _jsx('dt', { children: 'Speed' }),
                  /*#__PURE__*/ _jsx('dd', {
                    children:
                      row.lineSpeedMhr != null ? `${row.lineSpeedMhr} m/hr` : '—',
                  }),
                ],
              }),
              /*#__PURE__*/ _jsxs('div', {
                children: [
                  /*#__PURE__*/ _jsx('dt', { children: 'Qty' }),
                  /*#__PURE__*/ _jsx('dd', {
                    children:
                      row.tubeCount != null || row.totalMt != null
                        ? `${row.tubeCount ?? '—'} / ${row.totalMt ?? '—'} MT`
                        : '—',
                  }),
                ],
              }),
            ],
          }),

          /*#__PURE__*/ _jsx('p', {
            className: 'furnace-card__zones muted',
            children: zoneBrief(row.zones),
          }),

          row.openStoppage
            ? /*#__PURE__*/ _jsxs('p', {
                className: 'furnace-card__stop',
                children: [
                  'Stoppage ',
                  row.openStoppage.code,
                  row.openStoppage.reason ? ` — ${row.openStoppage.reason}` : '',
                ],
              })
            : null,

          /*#__PURE__*/ _jsxs('footer', {
            className: 'furnace-card__actions',
            children: [
              !idle
                ? /*#__PURE__*/ _jsx(ZButton, {
                    variant: 'primary',
                    onClick: () => onOpen?.(row),
                    children: 'Open',
                  })
                : null,
              idle
                ? /*#__PURE__*/ _jsx(ZButton, {
                    variant: 'primary',
                    disabled: assigning,
                    onClick: () => onAssign?.(row),
                    children: assigning ? 'Assigning…' : 'Assign Order',
                  })
                : null,
              status === 'COMPLETE'
                ? /*#__PURE__*/ _jsx(ZButton, {
                    variant: 'ghost',
                    onClick: () => onOpen?.(row),
                    children: 'View last',
                  })
                : null,
            ],
          }),
        ],
      }),
    ],
  });
}
