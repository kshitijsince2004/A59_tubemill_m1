import { ZBadge, ZButton, statusTone } from '../../ui';

function PlayIcon() {
  return (
    <svg
      className="wo-detail__play"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 5.5v13l11-6.5L8 5.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Screenshot-style Workorder details pane with pinned primary CTA.
 *
 * @param {object} props
 * @param {boolean} [props.empty]
 * @param {string} [props.emptyHint]
 * @param {string} [props.workOrderNo]
 * @param {string} [props.batchLabel]
 * @param {string|null} [props.backlogBadge]
 * @param {string} [props.status]
 * @param {string} [props.statusLabel]
 * @param {Array<{label: string, value: import('react').ReactNode, mono?: boolean}>} [props.fields]
 * @param {import('react').ReactNode} [props.extra]
 * @param {import('react').ReactNode} [props.banners]
 * @param {{ label: string, onClick: () => void, disabled?: boolean }} [props.primaryAction]
 * @param {{ label: string, onClick: () => void, disabled?: boolean }} [props.secondaryAction]
 */
export default function WorkOrderDetailPane({
  empty = false,
  emptyHint = 'Select a workorder from the list.',
  workOrderNo = '',
  batchLabel = '',
  backlogBadge = null,
  status = '',
  statusLabel = '',
  fields = [],
  extra = null,
  banners = null,
  primaryAction = null,
  secondaryAction = null,
}) {
  if (empty) {
    return (
      <div className="wo-detail wo-detail--empty">
        <p className="empty-hint">{emptyHint}</p>
      </div>
    );
  }

  const displayStatus = statusLabel || String(status || '—').replace(/_/g, ' ');
  const tone = statusTone(status);

  return (
    <div className="wo-detail">
      <div className="wo-detail__scroll">
        <header className="wo-detail__head">
          <div className="wo-detail__head-main">
            <span className="wo-detail__eyebrow">Order details</span>
            <div className="wo-detail__wo font-mono" title={String(workOrderNo)}>
              {String(workOrderNo || '—')}
            </div>
            {batchLabel ? (
              <div className="wo-detail__batch font-mono">{batchLabel}</div>
            ) : null}
          </div>
          {backlogBadge ? (
            <ZBadge tone="pending" className="wo-detail__backlog">
              {backlogBadge}
            </ZBadge>
          ) : null}
        </header>

        {extra}

        {fields.length ? (
          <div className="wo-detail__grid">
            {fields.map((f, i) => (
              <div key={`${f.label}-${i}`} className="wo-detail__field">
                <span className="wo-detail__label">{f.label}</span>
                <div className={`wo-detail__value${f.mono ? ' font-mono' : ''}`}>
                  {f.value == null || f.value === '' ? '—' : f.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {banners}
      </div>

      <footer className="wo-detail__footer">
        <div className="wo-detail__status-row">
          <span className="wo-detail__label">Status</span>
          <ZBadge tone={tone}>{displayStatus}</ZBadge>
        </div>
        {primaryAction ? (
          <ZButton
            variant="ghost"
            block
            className="wo-detail__cta"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            <span className="wo-detail__cta-inner">
              <PlayIcon />
              {primaryAction.label}
            </span>
          </ZButton>
        ) : null}
        {secondaryAction ? (
          <ZButton
            variant="ghost"
            block
            disabled={secondaryAction.disabled}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </ZButton>
        ) : null}
      </footer>
    </div>
  );
}
