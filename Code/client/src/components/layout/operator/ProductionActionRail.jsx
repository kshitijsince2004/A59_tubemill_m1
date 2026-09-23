import { ZBadge, ZButton, statusTone } from '../../../ui';
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

export default function ProductionActionRail({
  jobId,
  timer,
  statusLabel,
  primary,
  busy,
  disabled,
  hold,
  onStart,
  onResume,
  onEnd,
  onStoppage,
  onRemark,
  onHold
}) {
  const stoppageActive =
    String(statusLabel ?? '')
      .toUpperCase()
      .replace(/\s+/g, '_') === 'STOPPED' ||
    String(statusLabel ?? '')
      .toUpperCase()
      .replace(/\s+/g, '_') === 'STOPPAGE';

  return _jsxs('aside', {
    className: 'action-rail',
    'aria-label': 'Production actions',
    children: [
      _jsx('div', { className: 'action-rail__header', children: jobId }),
      _jsxs('div', {
        className: 'action-rail__stack',
        children: [
          primary === 'start' && onStart
            ? _jsx(ZButton, {
                variant: 'primary',
                disabled: disabled || busy,
                onClick: onStart,
                children: 'START'
              })
            : null,
          primary === 'resume' && onResume
            ? _jsx(ZButton, {
                variant: 'primary',
                disabled: disabled || busy,
                onClick: onResume,
                children: 'RESUME'
              })
            : null,
          primary === 'end' && onEnd
            ? _jsx(ZButton, {
                variant: 'danger',
                disabled: disabled || busy,
                onClick: onEnd,
                children: 'END'
              })
            : null,
          onStoppage
            ? _jsx(ZButton, {
                variant: 'ghost',
                disabled: busy || disabled,
                onClick: onStoppage,
                children: stoppageActive ? 'Manage Stop' : 'STOPPAGE'
              })
            : null,
          onRemark
            ? _jsx(ZButton, {
                variant: 'ghost',
                disabled: busy || disabled,
                onClick: onRemark,
                children: 'REMARK'
              })
            : null,
          onHold
            ? _jsx(ZButton, {
                variant: 'accent',
                disabled: disabled || busy,
                onClick: onHold,
                children: hold ? 'RESUME' : 'HOLD'
              })
            : null
        ]
      }),
      _jsxs('div', {
        className: 'action-rail__footer',
        children: [
          _jsx('span', {
            className: `font-mono action-rail__timer${stoppageActive ? ' action-rail__timer--stoppage' : ''}`,
            children: timer
          }),
          _jsx(ZBadge, {
            tone: statusTone(statusLabel),
            children: String(statusLabel).replace(/_/g, ' ')
          })
        ]
      })
    ]
  });
}
