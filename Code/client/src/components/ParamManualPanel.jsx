import { useEffect, useState } from 'react';
import { ZButton, ZInput, ZTextarea } from '../ui';

/**
 * MANUAL entry fields for TM-04 (until PLC).
 * Rendered inside FormModal by ParametersModule.
 */
export default function ParamManualPanel({
  onSave,
  onCancel,
  disabled,
  busy = false,
  initialWcToWrDistanceMm = '',
  setupArgonUsed = null,
}) {
  const [speedMpm, setSpeedMpm] = useState('');
  const [powerKw, setPowerKw] = useState('');
  const [wcToWrDistanceMm, setWcToWrDistanceMm] = useState(
    initialWcToWrDistanceMm !== '' && initialWcToWrDistanceMm != null
      ? String(initialWcToWrDistanceMm)
      : ''
  );
  const [coolantOilPct, setCoolantOilPct] = useState('');
  const [coolantPressureKg, setCoolantPressureKg] = useState('');
  const [wiperChange, setWiperChange] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [signRef, setSignRef] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialWcToWrDistanceMm !== '' && initialWcToWrDistanceMm != null) {
      setWcToWrDistanceMm(String(initialWcToWrDistanceMm));
    }
  }, [initialWcToWrDistanceMm]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        speedMpm: speedMpm ? Number(speedMpm) : undefined,
        powerKw: powerKw ? Number(powerKw) : undefined,
        wcToWrDistanceMm: wcToWrDistanceMm ? Number(wcToWrDistanceMm) : undefined,
        coolantOilPct: coolantOilPct ? Number(coolantOilPct) : undefined,
        coolantPressureKg: coolantPressureKg ? Number(coolantPressureKg) : undefined,
        wiperChange,
        argonUsed: setupArgonUsed ?? undefined,
        remarks: remarks || undefined,
        signRef: signRef || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const locked = disabled || busy || saving;

  return (
    <div className="stack-gap">
      <p className="muted" style={{ marginTop: 0 }}>
        Speed / power / WC–WR are manual until PLC integration. Coolant, wiper, remarks, and sign remain
        operator-entered.
      </p>
      <div className="form-row">
        <div>
          <label>Speed (PRC-07) · MPM</label>
          <ZInput
            value={speedMpm}
            onChange={(e) => setSpeedMpm(e.target.value)}
            disabled={locked}
            inputMode="decimal"
            autoFocus
          />
        </div>
        <div>
          <label>Power (PRC-08) · kW</label>
          <ZInput
            value={powerKw}
            onChange={(e) => setPowerKw(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
        </div>
      </div>
      <div className="form-row">
        <div>
          <label>Distance WC to WR (PRC-15) · mm</label>
          <ZInput
            value={wcToWrDistanceMm}
            onChange={(e) => setWcToWrDistanceMm(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
        </div>
        <div>
          <label>Oil % in coolant (PRC-16)</label>
          <ZInput
            value={coolantOilPct}
            onChange={(e) => setCoolantOilPct(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
        </div>
      </div>
      <div className="form-row">
        <div>
          <label>Coolant pressure (PRC-17) · kg</label>
          <ZInput
            value={coolantPressureKg}
            onChange={(e) => setCoolantPressureKg(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
        </div>
        <div>
          <label>Argon (PRC-18) · from Setup</label>
          <div className="value font-mono" style={{ paddingTop: '0.45rem' }}>
            {setupArgonUsed == null ? 'N/A' : setupArgonUsed ? 'YES' : 'NO'}
          </div>
        </div>
      </div>
      <div className="confirm-row">
        <input
          type="checkbox"
          checked={wiperChange}
          onChange={(e) => setWiperChange(e.target.checked)}
          disabled={locked}
        />
        <span>Wiper change / clean (PRC-19)</span>
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <label>Remarks (PRC-20)</label>
        <ZTextarea value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={locked} />
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <label>Sign (PRC-21)</label>
        <ZInput value={signRef} onChange={(e) => setSignRef(e.target.value)} disabled={locked} />
      </div>
      <div className="btn-row" style={{ marginTop: '0.85rem', justifyContent: 'flex-end' }}>
        {onCancel ? (
          <ZButton variant="ghost" disabled={locked} onClick={onCancel}>
            Cancel
          </ZButton>
        ) : null}
        <ZButton variant="primary" disabled={locked} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save parameter record'}
        </ZButton>
      </div>
    </div>
  );
}
