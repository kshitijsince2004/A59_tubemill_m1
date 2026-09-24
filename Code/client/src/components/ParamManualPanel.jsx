import { useEffect, useState } from 'react';
import { ZButton, ZInput, ZTextarea } from '../ui';

/**
 * MANUAL entry fields for TM-04 — horizontal tablet layout.
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
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialWcToWrDistanceMm !== '' && initialWcToWrDistanceMm != null) {
      setWcToWrDistanceMm(String(initialWcToWrDistanceMm));
    }
  }, [initialWcToWrDistanceMm]);

  function validate() {
    const next = {};
    if (!String(speedMpm).trim()) next.speedMpm = 'Required';
    if (!String(powerKw).trim()) next.powerKw = 'Required';
    if (!String(signRef).trim()) next.signRef = 'Required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
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
    <div className="tm-reading-form tm-reading-form--horizontal stack-gap">
      <p className="muted" style={{ marginTop: 0 }}>
        Enter values for this hour, review, then save. Fields marked * are required.
      </p>

      <div className="tm-reading-form__row form-row">
        <div className={errors.speedMpm ? 'tm-field-error' : ''}>
          <label>
            Speed <span className="tm-unit">mpm</span> <span className="tm-req">*</span>
            <span className="tm-hint">PRC-07</span>
          </label>
          <ZInput
            value={speedMpm}
            onChange={(e) => setSpeedMpm(e.target.value)}
            disabled={locked}
            inputMode="decimal"
            autoFocus
          />
          {errors.speedMpm ? <span className="error-text">{errors.speedMpm}</span> : null}
        </div>
        <div className={errors.powerKw ? 'tm-field-error' : ''}>
          <label>
            Power <span className="tm-unit">kW</span> <span className="tm-req">*</span>
            <span className="tm-hint">PRC-08</span>
          </label>
          <ZInput
            value={powerKw}
            onChange={(e) => setPowerKw(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
          {errors.powerKw ? <span className="error-text">{errors.powerKw}</span> : null}
        </div>
        <div>
          <label>
            WC → WR <span className="tm-unit">mm</span>
            <span className="tm-hint">PRC-15</span>
          </label>
          <ZInput
            value={wcToWrDistanceMm}
            onChange={(e) => setWcToWrDistanceMm(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
        </div>
        <div>
          <label>
            Coolant oil <span className="tm-unit">%</span>
            <span className="tm-hint">PRC-16</span>
          </label>
          <ZInput
            value={coolantOilPct}
            onChange={(e) => setCoolantOilPct(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
        </div>
        <div>
          <label>
            Coolant pressure <span className="tm-unit">kg</span>
            <span className="tm-hint">PRC-17</span>
          </label>
          <ZInput
            value={coolantPressureKg}
            onChange={(e) => setCoolantPressureKg(e.target.value)}
            disabled={locked}
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="tm-reading-form__row form-row">
        <div>
          <label>
            Argon <span className="tm-hint">from Setup</span>
          </label>
          <div className="value font-mono" style={{ paddingTop: '0.45rem', minHeight: 48 }}>
            {setupArgonUsed == null ? 'N/A' : setupArgonUsed ? 'YES' : 'NO'}
          </div>
        </div>
        <div>
          <label className="tm-touch-check confirm-row" style={{ marginTop: '1.4rem' }}>
            <input
              type="checkbox"
              checked={wiperChange}
              onChange={(e) => setWiperChange(e.target.checked)}
              disabled={locked}
            />
            <span>Wiper change / clean (PRC-19)</span>
          </label>
        </div>
        <div className={errors.signRef ? 'tm-field-error' : ''}>
          <label>
            Sign <span className="tm-req">*</span>
            <span className="tm-hint">PRC-21</span>
          </label>
          <ZInput value={signRef} onChange={(e) => setSignRef(e.target.value)} disabled={locked} />
          {errors.signRef ? <span className="error-text">{errors.signRef}</span> : null}
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label>
            Remarks <span className="tm-hint">PRC-20</span>
          </label>
          <ZTextarea value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={locked} />
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: '0.5rem', justifyContent: 'flex-end' }}>
        {onCancel ? (
          <ZButton variant="ghost" disabled={locked} onClick={onCancel}>
            Cancel
          </ZButton>
        ) : null}
        <ZButton variant="primary" disabled={locked} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save reading'}
        </ZButton>
      </div>
    </div>
  );
}
