import { useState } from 'react';
import { ZButton, ZInput } from '../ui';

interface Props {
  coils: Record<string, unknown>[];
  onAdd: (data: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
}

export default function CoilInputFan({ coils, onAdd, disabled }: Props) {
  const [coilTag, setCoilTag] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [spliceSeq, setSpliceSeq] = useState(String(coils.length + 1));
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!coilTag.trim()) return;
    setBusy(true);
    try {
      await onAdd({
        coilTag: coilTag.trim(),
        inputWeightKg: weightKg ? Number(weightKg) : undefined,
        spliceSeq: Number(spliceSeq),
      });
      setCoilTag('');
      setWeightKg('');
      setSpliceSeq(String(coils.length + 2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Coil Input Fan</h2>
      <div className="form-row">
        <div>
          <label>Coil Tag</label>
          <ZInput value={coilTag} onChange={(e) => setCoilTag(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Input Weight (kg)</label>
          <ZInput value={weightKg} onChange={(e) => setWeightKg(e.target.value)} disabled={disabled} />
        </div>
      </div>
      <div className="form-row">
        <div>
          <label>Splice Seq</label>
          <ZInput value={spliceSeq} onChange={(e) => setSpliceSeq(e.target.value)} disabled={disabled} />
        </div>
      </div>
      <ZButton variant="primary" disabled={disabled || busy} onClick={() => void handleAdd()}>
        Add Coil
      </ZButton>
      {coils.length > 0 && (
        <table className="table" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Seq</th>
              <th>Coil Tag</th>
              <th>Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {coils.map((c) => (
              <tr key={String(c.id)}>
                <td>{String(c.splice_seq ?? '—')}</td>
                <td>{String(c.coil_tag)}</td>
                <td>{String(c.input_weight_kg ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
