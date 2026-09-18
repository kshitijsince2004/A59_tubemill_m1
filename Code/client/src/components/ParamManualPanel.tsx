import { useState } from 'react';
import { ZButton, ZBadge, ZInput, ZTextarea } from '../ui';

interface Props {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
}

export default function ParamManualPanel({ onSave, disabled }: Props) {
  const [coolantOilPct, setCoolantOilPct] = useState('');
  const [coolantPressureKg, setCoolantPressureKg] = useState('');
  const [wiperChange, setWiperChange] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    await onSave({
      coolantOilPct: coolantOilPct ? Number(coolantOilPct) : undefined,
      coolantPressureKg: coolantPressureKg ? Number(coolantPressureKg) : undefined,
      wiperChange,
      remarks: remarks || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="panel">
      <h2>Manual Parameters (Hourly)</h2>
      <div className="form-row">
        <div>
          <label>Coolant Oil %</label>
          <ZInput value={coolantOilPct} onChange={(e) => setCoolantOilPct(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Coolant Pressure (kg)</label>
          <ZInput
            value={coolantPressureKg}
            onChange={(e) => setCoolantPressureKg(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="confirm-row">
        <input
          type="checkbox"
          checked={wiperChange}
          onChange={(e) => setWiperChange(e.target.checked)}
          disabled={disabled}
        />
        <span>Wiper changed this hour</span>
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <label>Remarks</label>
        <ZTextarea value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={disabled} />
      </div>
      <div className="btn-row" style={{ marginTop: '0.75rem' }}>
        <ZButton variant="primary" disabled={disabled} onClick={() => void handleSave()}>
          Save Manual Params
        </ZButton>
        {saved && <ZBadge tone="success">Saved</ZBadge>}
      </div>
    </div>
  );
}
