import { useEffect, useState } from 'react';
import { ZButton, ZBadge, ZInput, ZSelect } from '../ui';

interface Props {
  bundles: Record<string, unknown>[];
  suggestedPieces: number;
  onAdd: (data: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
}

function nextBundleNo(bundles: Record<string, unknown>[]) {
  const max = bundles.reduce((m, b) => Math.max(m, Number(b.bundle_no) || 0), 0);
  return max + 1;
}

export default function BundleFan({ bundles, suggestedPieces, onAdd, disabled }: Props) {
  const [bundleNo, setBundleNo] = useState(String(nextBundleNo(bundles)));
  const [pieces, setPieces] = useState(String(suggestedPieces || 50));
  const [qualityClass, setQualityClass] = useState('PRIME');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBundleNo(String(nextBundleNo(bundles)));
  }, [bundles]);

  async function handleAdd() {
    setBusy(true);
    try {
      await onAdd({
        bundleNo: Number(bundleNo) || nextBundleNo(bundles),
        pieces: Number(pieces),
        qualityClass,
        weightSource: 'DERIVED',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Bundle Output Fan</h2>
      <div className="form-row">
        <div>
          <label>Bundle No</label>
          <ZInput value={bundleNo} onChange={(e) => setBundleNo(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Pieces</label>
          <ZInput value={pieces} onChange={(e) => setPieces(e.target.value)} disabled={disabled} />
        </div>
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <label>Quality Class</label>
        <ZSelect value={qualityClass} onChange={(e) => setQualityClass(e.target.value)} disabled={disabled}>
          <option value="PRIME">PRIME</option>
          <option value="PQ2">PQ2</option>
          <option value="CQ">CQ</option>
          <option value="OPEN">OPEN</option>
          <option value="SCRAP">SCRAP</option>
        </ZSelect>
      </div>
      <ZButton variant="primary" disabled={disabled || busy} onClick={() => void handleAdd()}>
        Add Bundle
      </ZButton>
      {bundles.length > 0 && (
        <table className="table" style={{ marginTop: '1rem' }}>
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
                  <ZBadge tone={b.quality_class === 'SCRAP' ? 'warn' : 'success'}>{String(b.quality_class)}</ZBadge>
                </td>
                <td>{String(b.weight_kg ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
