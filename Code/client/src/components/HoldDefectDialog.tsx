import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { tubemillApi } from '../api/tubemillClient';
import { ZButton, ZInput, ZSelect, ZTextarea } from '../ui';

interface Props {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (payload: {
    defectCode: string;
    pieces?: number;
    quantityMt?: number;
    remark?: string;
  }) => void;
}

export default function HoldDefectDialog({ open, busy, onCancel, onConfirm }: Props) {
  const codes = useQuery({ queryKey: ['defect-codes'], queryFn: () => tubemillApi.getDefectCodes(), enabled: open });
  const [defectCode, setDefectCode] = useState('');
  const [pieces, setPieces] = useState('');
  const [quantityMt, setQuantityMt] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  return (
    <div className="modal-scrim" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-labelledby="hold-defect-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-card__header">
          <div>
            <div className="eyebrow">Hold</div>
            <h2 id="hold-defect-title">Log defect &amp; hold</h2>
          </div>
          <button type="button" className="modal-card__close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-card__body">
          {error && <p className="error-text">{error}</p>}
          <label className="eyebrow">Defect code</label>
          <ZSelect value={defectCode} onChange={(e) => setDefectCode(e.target.value)} required>
            <option value="">Select…</option>
            {(codes.data ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </ZSelect>
          <label className="eyebrow">Pieces</label>
          <ZInput type="number" value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="Optional" />
          <label className="eyebrow">Quantity MT</label>
          <ZInput
            type="number"
            step="0.001"
            value={quantityMt}
            onChange={(e) => setQuantityMt(e.target.value)}
            placeholder="Optional"
          />
          <label className="eyebrow">Remark</label>
          <ZTextarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} placeholder="Optional" />
        </div>
        <footer className="modal-card__footer">
          <ZButton variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </ZButton>
          <ZButton
            variant="accent"
            disabled={busy}
            onClick={() => {
              if (!defectCode) {
                setError('Defect code is required');
                return;
              }
              setError('');
              onConfirm({
                defectCode,
                pieces: pieces ? Number(pieces) : undefined,
                quantityMt: quantityMt ? Number(quantityMt) : undefined,
                remark: remark.trim() || undefined,
              });
            }}
          >
            Hold
          </ZButton>
        </footer>
      </div>
    </div>
  );
}
