import { useState } from 'react';
import { ZButton, ZInput } from '../ui';
import { deviceApi } from '../api/operatorApi';
import { authApi } from '../api/authApi';
import { stopKiosk, createLogoExitGesture } from '../native/kiosk';

/**
 * First-launch device ↔ line binding + maintenance exit (supervisor PIN).
 */
export default function DeviceSetupPanel({ onBound, onExitKiosk }) {
  const [lineCode, setLineCode] = useState('');
  const [plantCode, setPlantCode] = useState('A59');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [emp, setEmp] = useState('');
  const [pin, setPin] = useState('');

  const onLogoTap = createLogoExitGesture({ onArmed: () => setExitOpen(true) });

  async function bind() {
    setBusy(true);
    setError(null);
    try {
      let deviceId = sessionStorage.getItem('a59-device-id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        sessionStorage.setItem('a59-device-id', deviceId);
      }
      const data = await deviceApi.register({
        deviceId,
        plantCode: plantCode.trim() || 'A59',
        lineCode: lineCode.trim(),
      });
      localStorage.setItem('a59-line-bound', data.lineCode);
      onBound?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bind failed');
    } finally {
      setBusy(false);
    }
  }

  async function exitKiosk() {
    setBusy(true);
    setError(null);
    try {
      await authApi.supervisorOverride(emp.trim(), pin, { action: 'KIOSK_EXIT' });
      await stopKiosk();
      onExitKiosk?.();
      setExitOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exit denied');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen__card" style={{ maxWidth: 420 }}>
      <h2 onClick={onLogoTap} style={{ cursor: 'default', userSelect: 'none' }}>
        Tablet setup
      </h2>
      <p className="muted">Bind this tablet to a plant line (requires Machine Head / Admin).</p>
      {error ? <div className="error-strip">{error}</div> : null}
      <label className="eyebrow">Plant</label>
      <ZInput value={plantCode} onChange={(e) => setPlantCode(e.target.value)} />
      <label className="eyebrow">Line code</label>
      <ZInput
        value={lineCode}
        onChange={(e) => setLineCode(e.target.value)}
        placeholder="A-59 / RHF-03 / …"
      />
      <ZButton variant="primary" disabled={busy || !lineCode.trim()} onClick={() => void bind()}>
        Bind tablet
      </ZButton>

      {exitOpen ? (
        <div style={{ marginTop: 24 }}>
          <h3>Maintenance exit</h3>
          <label className="eyebrow">Supervisor badge</label>
          <ZInput value={emp} onChange={(e) => setEmp(e.target.value)} />
          <label className="eyebrow">PIN</label>
          <ZInput
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <ZButton variant="danger" disabled={busy} onClick={() => void exitKiosk()}>
            Stop lock task
          </ZButton>
        </div>
      ) : null}
    </div>
  );
}
