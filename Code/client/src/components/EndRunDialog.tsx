import { useState } from 'react';
import { ZButton, ZTextarea } from '../ui';

interface Props {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (remark: string) => void;
}

export default function EndRunDialog({ open, busy, onCancel, onConfirm }: Props) {
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  return (
    <div className="modal-scrim" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-labelledby="end-run-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-card__header">
          <div>
            <div className="eyebrow">End job</div>
            <h2 id="end-run-title">End production</h2>
            <p className="muted">Enter a remark before ending this run.</p>
          </div>
          <button type="button" className="modal-card__close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-card__body">
          {error && <p className="error-text">{error}</p>}
          <label className="eyebrow">Remark</label>
          <ZTextarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={4}
            placeholder="Why is this job ending?"
            autoFocus
          />
        </div>
        <footer className="modal-card__footer">
          <ZButton variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </ZButton>
          <ZButton
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (!remark.trim()) {
                setError('Remark is required');
                return;
              }
              setError('');
              onConfirm(remark.trim());
            }}
          >
            End
          </ZButton>
        </footer>
      </div>
    </div>
  );
}
