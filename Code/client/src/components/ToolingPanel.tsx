import { useState } from 'react';
import type { Run } from '../api/tubemillClient';
import { ZButton, ZInput } from '../ui';

interface Props {
  run: Run;
  onConfirm: (data: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
}

export default function ToolingPanel({ run, onConfirm, disabled }: Props) {
  const t = run.tooling ?? {};
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [vLengthMm, setVLengthMm] = useState('');
  const [vGapMm, setVGapMm] = useState('');
  const [weldDiaMm, setWeldDiaMm] = useState(String(t.weldDiaMm ?? ''));
  const [argonUsed, setArgonUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fields = [
    { key: 'idTool', label: 'ID Tool', value: t.idTool },
    { key: 'odTool', label: 'OD Tool', value: t.odTool },
    { key: 'boggieSize', label: 'Boggie', value: t.boggieSize },
    { key: 'impederSize', label: 'Impeder', value: t.impederSize },
    { key: 'ferriteRod', label: 'Ferrite Rod', value: t.ferriteRod },
    { key: 'ssRod', label: 'SS Rod', value: t.ssRod },
    { key: 'workCoilId', label: 'Work Coil', value: t.workCoilId },
    { key: 'seamGuide', label: 'Seam Guide', value: t.seamGuide },
  ];

  const allConfirmed = fields.every((f) => confirmed[f.key]);

  async function handleSubmit() {
    setError('');
    setBusy(true);
    try {
      await onConfirm({
        setupType: 'INITIAL',
        reason: 'NEW_PRODUCT',
        idTool: t.idTool,
        odTool: t.odTool,
        boggieSize: t.boggieSize,
        impederSize: t.impederSize,
        ferriteRod: t.ferriteRod,
        ssRod: t.ssRod,
        workCoilId: t.workCoilId,
        vLengthMm: vLengthMm ? Number(vLengthMm) : undefined,
        vGapMm: vGapMm ? Number(vGapMm) : undefined,
        weldDiaMm: weldDiaMm ? Number(weldDiaMm) : undefined,
        argonUsed,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Tooling (TM-02 Autofill)</h2>
      {fields.map((f) => (
        <div key={f.key} className="confirm-row">
          <input
            type="checkbox"
            checked={!!confirmed[f.key]}
            onChange={(e) => setConfirmed((c) => ({ ...c, [f.key]: e.target.checked }))}
            disabled={disabled}
          />
          <span>
            <strong>{f.label}:</strong> <span className="font-mono">{String(f.value ?? '—')}</span>
          </span>
        </div>
      ))}
      <div className="form-row">
        <div>
          <label>V Length (mm)</label>
          <ZInput value={vLengthMm} onChange={(e) => setVLengthMm(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>V Gap (mm)</label>
          <ZInput value={vGapMm} onChange={(e) => setVGapMm(e.target.value)} disabled={disabled} />
        </div>
      </div>
      <div className="form-row">
        <div>
          <label>Weld Dia (mm)</label>
          <ZInput value={weldDiaMm} onChange={(e) => setWeldDiaMm(e.target.value)} disabled={disabled} />
        </div>
        <div className="confirm-row" style={{ marginTop: '1.5rem' }}>
          <input
            type="checkbox"
            checked={argonUsed}
            onChange={(e) => setArgonUsed(e.target.checked)}
            disabled={disabled}
          />
          <span>Argon used</span>
        </div>
      </div>
      <div className="btn-row">
        <ZButton variant="primary" disabled={disabled || !allConfirmed || busy} onClick={() => void handleSubmit()}>
          Confirm Tooling
        </ZButton>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
