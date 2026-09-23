import { ZButton } from '../ui';

/**
 * Shared popup shell for operator input forms.
 * Uses existing modal-scrim / modal-card styles.
 */
export default function FormModal({
  open,
  title,
  eyebrow = 'Input',
  description,
  onClose,
  children,
  footer,
  wide = true,
  className = '',
}) {
  if (!open) return null;

  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <div
        className={`modal-card${wide ? ' modal-card--form' : ''} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-card__header">
          <div>
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            <h2 id="form-modal-title">{title}</h2>
            {description ? <p className="muted">{description}</p> : null}
          </div>
          <button
            type="button"
            className="modal-card__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="modal-card__body">{children}</div>
        {footer === undefined ? (
          <footer className="modal-card__footer">
            <ZButton variant="ghost" onClick={onClose}>
              Cancel
            </ZButton>
          </footer>
        ) : footer ? (
          <footer className="modal-card__footer">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
