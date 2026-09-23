import { useEffect, useState } from 'react';
import { ZButton, ZBadge, ZInput, ZSelect } from '../ui';
import FormModal from './FormModal';

function nextBundleNo(bundles) {
  const max = bundles.reduce((m, b) => Math.max(m, Number(b.bundle_no) || 0), 0);
  return max + 1;
}

export default function BundleFan({ bundles, suggestedPieces, onAdd, disabled }) {
  const [open, setOpen] = useState(false);
  const [bundleNo, setBundleNo] = useState(String(nextBundleNo(bundles)));
  const [pieces, setPieces] = useState(String(suggestedPieces || 50));
  const [qualityClass, setQualityClass] = useState('PRIME');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBundleNo(String(nextBundleNo(bundles)));
  }, [bundles]);

  function openForm() {
    setBundleNo(String(nextBundleNo(bundles)));
    setPieces(String(suggestedPieces || 50));
    setQualityClass('PRIME');
    setOpen(true);
  }

  async function handleAdd() {
    setBusy(true);
    try {
      await onAdd({
        bundleNo: Number(bundleNo) || nextBundleNo(bundles),
        pieces: Number(pieces),
        qualityClass,
        weightSource: 'DERIVED',
      });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <header className="panel__header">
        <h2 style={{ margin: 0 }}>Bundle Output Fan</h2>
        <ZButton variant="primary" disabled={disabled} onClick={openForm}>
          Add Bundle
        </ZButton>
      </header>

      {bundles.length > 0 ? (
        <table className="table" style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>No</th>
              <th>Pieces</th>
              <th>Quality</th>
              <th>Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={String(b.id)}>
                <td>{String(b.bundle_no)}</td>
                <td>{String(b.pieces)}</td>
                <td>
                  <ZBadge tone={b.quality_class === 'SCRAP' ? 'warn' : 'success'}>
                    {String(b.quality_class)}
                  </ZBadge>
                </td>
                <td>{String(b.weight_kg ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-hint">No bundles yet. Use Add Bundle to enter output.</p>
      )}

      <FormModal
        open={open}
        eyebrow="Bundle output"
        title="Add bundle"
        description="Record a production bundle for the current run."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ZButton variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </ZButton>
            <ZButton
              variant="primary"
              disabled={disabled || busy}
              onClick={() => void handleAdd()}
            >
              {busy ? 'Saving…' : 'Save bundle'}
            </ZButton>
          </>
        }
      >
        <div className="form-row">
          <div>
            <label>Bundle No</label>
            <ZInput
              value={bundleNo}
              onChange={(e) => setBundleNo(e.target.value)}
              disabled={disabled || busy}
              autoFocus
            />
          </div>
          <div>
            <label>Pieces</label>
            <ZInput
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label>Quality Class</label>
          <ZSelect
            value={qualityClass}
            onChange={(e) => setQualityClass(e.target.value)}
            disabled={disabled || busy}
          >
            <option value="PRIME">PRIME</option>
            <option value="PQ2">PQ2</option>
            <option value="CQ">CQ</option>
            <option value="OPEN">OPEN</option>
            <option value="SCRAP">SCRAP</option>
          </ZSelect>
        </div>
      </FormModal>
    </div>
  );
}
