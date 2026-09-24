import { useMemo, useState } from 'react';
import { ZButton, ZInput, ZSelect } from '../ui';

function str(v) {
  if (v == null || v === '') return '';
  return String(v);
}

/**
 * TM-05 setup confirm form.
 * `initial` prefills MANUAL fields when duplicating an existing mill setup.
 */
export default function ToolingPanel({
  run,
  tooling: toolingProp,
  band: bandProp,
  initial = null,
  defaultNote = '',
  onConfirm,
  disabled,
}) {
  const t = toolingProp ?? run?.tooling ?? {};
  const band = bandProp ?? run?.band ?? {};
  const init = initial ?? {};

  const [setupName, setSetupName] = useState(defaultNote || '');
  const [confirmed, setConfirmed] = useState({});
  const [vLengthMm, setVLengthMm] = useState(str(init.vLengthMm));
  const [vGapMm, setVGapMm] = useState(str(init.vGapMm));
  const [wcToWr, setWcToWr] = useState(str(init.wcToWrDistanceMm));
  const [weldDiaMm, setWeldDiaMm] = useState(str(init.weldDiaMm ?? t.weldDiaMm));
  const [argonUsed, setArgonUsed] = useState(Boolean(init.argonUsed));
  const [wiperUsed, setWiperUsed] = useState(Boolean(init.wiperUsed));
  const [weldFlowOk, setWeldFlowOk] = useState(init.weldFlowOk != null ? Boolean(init.weldFlowOk) : true);
  const [ectCalibrated, setEctCalibrated] = useState(Boolean(init.ectCalibrated));
  const [coolantConcPct, setCoolantConcPct] = useState(str(init.coolantConcPct));
  const [coolantPressureKg, setCoolantPressureKg] = useState(str(init.coolantPressureKg));
  const [slitThkMm, setSlitThkMm] = useState(str(init.slitThkMm));
  const [slitWidthMm, setSlitWidthMm] = useState(str(init.slitWidthMm));
  const [rollSet, setRollSet] = useState(str(init.rollSet));
  const [speedMpmObs, setSpeedMpmObs] = useState(str(init.speedMpmObs));
  const [powerKwObs, setPowerKwObs] = useState(str(init.powerKwObs));
  const [ff1, setFf1] = useState(str(init.finPassDims?.FF1));
  const [ff2, setFf2] = useState(str(init.finPassDims?.FF2));
  const [ff3, setFf3] = useState(str(init.finPassDims?.FF3));
  const [firstOffOd, setFirstOffOd] = useState(str(init.firstOffDims?.odMm));
  const [firstOffThk, setFirstOffThk] = useState(str(init.firstOffDims?.thkMm));
  const [weldFlowSurfaceVangle, setWeldFlowSurfaceVangle] = useState(str(init.weldFlowSurfaceVangle));
  const [is4mChange, setIs4mChange] = useState(Boolean(init.is4mChange));
  const [m4Category, setM4Category] = useState(str(init.m4Category));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fields = useMemo(
    () => [
      { key: 'idTool', label: 'ID Tool', value: t.idTool },
      { key: 'odTool', label: 'OD Tool', value: t.odTool },
      { key: 'boggieSize', label: 'Boggie', value: t.boggieSize },
      { key: 'impederSize', label: 'Impeder', value: t.impederSize },
      { key: 'ferriteRod', label: 'Ferrite Rod', value: t.ferriteRod },
      { key: 'ssRod', label: 'SS Rod', value: t.ssRod },
      { key: 'workCoilId', label: 'Work Coil', value: t.workCoilId },
      { key: 'seamGuide', label: 'Seam Guide', value: t.seamGuide },
    ],
    [t]
  );

  const allConfirmed = fields.every((f) => confirmed[f.key]);
  const speedSpec =
    band.speedMinMpm != null && band.speedMaxMpm != null
      ? `${band.speedMinMpm}–${band.speedMaxMpm}`
      : '—';
  const powerSpec =
    band.powerKwMin != null && band.powerKwMax != null
      ? `${band.powerKwMin}–${band.powerKwMax}`
      : '—';

  async function handleSubmit() {
    setError('');
    const name = setupName.trim();
    if (!name) {
      setError('Setup name is required');
      return;
    }
    setBusy(true);
    try {
      const finPassDims = {};
      if (ff1) finPassDims.FF1 = Number(ff1);
      if (ff2) finPassDims.FF2 = Number(ff2);
      if (ff3) finPassDims.FF3 = Number(ff3);

      await onConfirm({
        note: name,
        setupType: 'INITIAL',
        reason: 'NEW_PRODUCT',
        idTool: t.idTool,
        odTool: t.odTool,
        boggieSize: t.boggieSize,
        impederSize: t.impederSize,
        ferriteRod: t.ferriteRod,
        ssRod: t.ssRod,
        workCoilId: t.workCoilId,
        seamGuide: t.seamGuide,
        vLengthMm: vLengthMm ? Number(vLengthMm) : undefined,
        vGapMm: vGapMm ? Number(vGapMm) : undefined,
        wcToWrDistanceMm: wcToWr ? Number(wcToWr) : undefined,
        weldDiaMm: weldDiaMm ? Number(weldDiaMm) : undefined,
        argonUsed,
        wiperUsed,
        weldFlowOk,
        ectCalibrated,
        coolantConcPct: coolantConcPct ? Number(coolantConcPct) : undefined,
        coolantPressureKg: coolantPressureKg ? Number(coolantPressureKg) : undefined,
        slitThkMm: slitThkMm ? Number(slitThkMm) : undefined,
        slitWidthMm: slitWidthMm ? Number(slitWidthMm) : undefined,
        rollSet: rollSet || undefined,
        speedMpmObs: speedMpmObs ? Number(speedMpmObs) : undefined,
        powerKwObs: powerKwObs ? Number(powerKwObs) : undefined,
        firstOffDims: {
          odMm: firstOffOd ? Number(firstOffOd) : undefined,
          thkMm: firstOffThk ? Number(firstOffThk) : undefined,
        },
        finPassDims: Object.keys(finPassDims).length ? finPassDims : undefined,
        weldFlowSurfaceVangle: weldFlowSurfaceVangle || undefined,
        is4mChange,
        m4Category: m4Category || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tm-setup-form">
      <div className="form-row">
        <div>
          <label>Setup name</label>
          <ZInput
            value={setupName}
            onChange={(e) => setSetupName(e.target.value)}
            disabled={disabled}
            placeholder="e.g. OD25.4-1010-2.6"
            autoFocus
          />
        </div>
      </div>

      <h3 className="tm-setup-form__group">Tooling (confirm)</h3>
      <div className="tm-setup-form__checks">
        {fields.map((f) => (
          <label key={f.key} className="confirm-row tm-touch-check">
            <input
              type="checkbox"
              checked={!!confirmed[f.key]}
              onChange={(e) => setConfirmed((c) => ({ ...c, [f.key]: e.target.checked }))}
              disabled={disabled}
            />
            <span>
              <strong>{f.label}:</strong>{' '}
              <span className="font-mono">{String(f.value ?? '—')}</span>
            </span>
          </label>
        ))}
      </div>

      <h3 className="tm-setup-form__group">Manual setup</h3>
      <div className="form-row tm-reading-form__row">
        <div>
          <label>Slit thk (mm)</label>
          <ZInput value={slitThkMm} onChange={(e) => setSlitThkMm(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Slit width (mm)</label>
          <ZInput value={slitWidthMm} onChange={(e) => setSlitWidthMm(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Roll set</label>
          <ZInput value={rollSet} onChange={(e) => setRollSet(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Speed mpm (spec)</label>
          <div className="value font-mono">{speedSpec}</div>
        </div>
        <div>
          <label>Speed mpm (obs)</label>
          <ZInput value={speedMpmObs} onChange={(e) => setSpeedMpmObs(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Power kW (spec)</label>
          <div className="value font-mono">{powerSpec}</div>
        </div>
        <div>
          <label>Power kW (obs)</label>
          <ZInput value={powerKwObs} onChange={(e) => setPowerKwObs(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>V Length (mm)</label>
          <ZInput value={vLengthMm} onChange={(e) => setVLengthMm(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>V Gap (mm)</label>
          <ZInput value={vGapMm} onChange={(e) => setVGapMm(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>WC→WR (mm)</label>
          <ZInput value={wcToWr} onChange={(e) => setWcToWr(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Weld Dia (mm)</label>
          <ZInput value={weldDiaMm} onChange={(e) => setWeldDiaMm(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Coolant conc %</label>
          <ZInput value={coolantConcPct} onChange={(e) => setCoolantConcPct(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Coolant pressure (kg)</label>
          <ZInput
            value={coolantPressureKg}
            onChange={(e) => setCoolantPressureKg(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="form-row tm-reading-form__row">
        <div>
          <label>Fin FF1</label>
          <ZInput value={ff1} onChange={(e) => setFf1(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Fin FF2</label>
          <ZInput value={ff2} onChange={(e) => setFf2(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Fin FF3</label>
          <ZInput value={ff3} onChange={(e) => setFf3(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>First-off OD</label>
          <ZInput value={firstOffOd} onChange={(e) => setFirstOffOd(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>First-off THK</label>
          <ZInput value={firstOffThk} onChange={(e) => setFirstOffThk(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <label>Weld flow / V angle</label>
          <ZInput
            value={weldFlowSurfaceVangle}
            onChange={(e) => setWeldFlowSurfaceVangle(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <label>4M category</label>
          <ZSelect
            value={m4Category}
            onChange={(e) => setM4Category(e.target.value)}
            disabled={disabled || !is4mChange}
          >
            <option value="">—</option>
            <option value="MAN">MAN</option>
            <option value="MATERIAL">MATERIAL</option>
            <option value="MACHINE">MACHINE</option>
            <option value="METHOD">METHOD</option>
          </ZSelect>
        </div>
      </div>

      <div className="tm-setup-form__checks">
        <label className="confirm-row tm-touch-check">
          <input type="checkbox" checked={argonUsed} onChange={(e) => setArgonUsed(e.target.checked)} disabled={disabled} />
          <span>Argon used</span>
        </label>
        <label className="confirm-row tm-touch-check">
          <input type="checkbox" checked={wiperUsed} onChange={(e) => setWiperUsed(e.target.checked)} disabled={disabled} />
          <span>Wiper used</span>
        </label>
        <label className="confirm-row tm-touch-check">
          <input type="checkbox" checked={weldFlowOk} onChange={(e) => setWeldFlowOk(e.target.checked)} disabled={disabled} />
          <span>Bead / weld-flow OK</span>
        </label>
        <label className="confirm-row tm-touch-check">
          <input
            type="checkbox"
            checked={ectCalibrated}
            onChange={(e) => setEctCalibrated(e.target.checked)}
            disabled={disabled}
          />
          <span>ECT calibrated</span>
        </label>
        <label className="confirm-row tm-touch-check">
          <input
            type="checkbox"
            checked={is4mChange}
            onChange={(e) => setIs4mChange(e.target.checked)}
            disabled={disabled}
          />
          <span>4M change</span>
        </label>
      </div>

      <div className="btn-row tm-setup-form__sticky">
        <ZButton
          variant="primary"
          disabled={disabled || !allConfirmed || busy}
          onClick={() => void handleSubmit()}
        >
          {busy ? 'Saving…' : 'Confirm Setup'}
        </ZButton>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
