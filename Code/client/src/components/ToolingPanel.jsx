import { useState } from 'react';

import { ZButton, ZInput, ZSelect } from '../ui';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function ToolingPanel({ run, tooling: toolingProp, band: bandProp, onConfirm, disabled }) {
  const t = toolingProp ?? run?.tooling ?? {};
  const band = bandProp ?? run?.band ?? {};
  const [confirmed, setConfirmed] = useState({});
  const [vLengthMm, setVLengthMm] = useState('');
  const [vGapMm, setVGapMm] = useState('');
  const [wcToWr, setWcToWr] = useState('');
  const [weldDiaMm, setWeldDiaMm] = useState(String(t.weldDiaMm ?? ''));
  const [argonUsed, setArgonUsed] = useState(false);
  const [wiperUsed, setWiperUsed] = useState(false);
  const [weldFlowOk, setWeldFlowOk] = useState(true);
  const [ectCalibrated, setEctCalibrated] = useState(false);
  const [coolantConcPct, setCoolantConcPct] = useState('');
  const [coolantPressureKg, setCoolantPressureKg] = useState('');
  const [slitThkMm, setSlitThkMm] = useState('');
  const [slitWidthMm, setSlitWidthMm] = useState('');
  const [rollSet, setRollSet] = useState('');
  const [speedMpmObs, setSpeedMpmObs] = useState('');
  const [powerKwObs, setPowerKwObs] = useState('');
  const [ff1, setFf1] = useState('');
  const [ff2, setFf2] = useState('');
  const [ff3, setFf3] = useState('');
  const [firstOffOd, setFirstOffOd] = useState('');
  const [firstOffThk, setFirstOffThk] = useState('');
  const [weldFlowSurfaceVangle, setWeldFlowSurfaceVangle] = useState('');
  const [is4mChange, setIs4mChange] = useState(false);
  const [m4Category, setM4Category] = useState('');
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
  { key: 'seamGuide', label: 'Seam Guide', value: t.seamGuide }];


  const allConfirmed = fields.every((f) => confirmed[f.key]);

  const speedSpec =
  band.speedMinMpm != null && band.speedMaxMpm != null ?
  `${band.speedMinMpm}–${band.speedMaxMpm}` :
  '—';
  const powerSpec =
  band.powerKwMin != null && band.powerKwMax != null ?
  `${band.powerKwMin}–${band.powerKwMax}` :
  '—';

  async function handleSubmit() {
    setError('');
    setBusy(true);
    try {
      const finPassDims = {};
      if (ff1) finPassDims.FF1 = Number(ff1);
      if (ff2) finPassDims.FF2 = Number(ff2);
      if (ff3) finPassDims.FF3 = Number(ff3);

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
          thkMm: firstOffThk ? Number(firstOffThk) : undefined
        },
        finPassDims: Object.keys(finPassDims).length ? finPassDims : undefined,
        weldFlowSurfaceVangle: weldFlowSurfaceVangle || undefined,
        is4mChange,
        m4Category: m4Category || undefined
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  }

  return (/*#__PURE__*/
    _jsxs("div", { className: "panel", children: [/*#__PURE__*/
      _jsx("h2", { children: "GLI-FT-PRD-TM-05 Mill Setup Parameter Sheet" }), /*#__PURE__*/
      _jsx("p", { className: "muted", style: { marginTop: 0 }, children: "Tooling prefilled from TM-02 chart \u2014 confirm DERIVED fields and enter MANUAL setup / first-off values" }

      ),
      fields.map((f) => /*#__PURE__*/
      _jsxs("div", { className: "confirm-row", children: [/*#__PURE__*/
        _jsx("input", {
          type: "checkbox",
          checked: !!confirmed[f.key],
          onChange: (e) => setConfirmed((c) => ({ ...c, [f.key]: e.target.checked })),
          disabled: disabled }
        ), /*#__PURE__*/
        _jsxs("span", { children: [/*#__PURE__*/
          _jsxs("strong", { children: [f.label, ":"] }), " ", /*#__PURE__*/_jsx("span", { className: "font-mono", children: String(f.value ?? '—') })] }
        )] }, f.key
      )
      ), /*#__PURE__*/
      _jsxs("div", { className: "form-row", children: [/*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Slit thk (mm)" }), /*#__PURE__*/
          _jsx(ZInput, { value: slitThkMm, onChange: (e) => setSlitThkMm(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Slit width (mm)" }), /*#__PURE__*/
          _jsx(ZInput, { value: slitWidthMm, onChange: (e) => setSlitWidthMm(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Roll set" }), /*#__PURE__*/
          _jsx(ZInput, { value: rollSet, onChange: (e) => setRollSet(e.target.value), disabled: disabled })] }
        )] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "form-row", children: [/*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Speed mpm (spec)" }), /*#__PURE__*/
          _jsx("div", { className: "value font-mono", children: speedSpec })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Speed mpm (obs)" }), /*#__PURE__*/
          _jsx(ZInput, { value: speedMpmObs, onChange: (e) => setSpeedMpmObs(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Power kW (spec)" }), /*#__PURE__*/
          _jsx("div", { className: "value font-mono", children: powerSpec })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Power kW (obs)" }), /*#__PURE__*/
          _jsx(ZInput, { value: powerKwObs, onChange: (e) => setPowerKwObs(e.target.value), disabled: disabled })] }
        )] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "form-row", children: [/*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "V Length (mm)" }), /*#__PURE__*/
          _jsx(ZInput, { value: vLengthMm, onChange: (e) => setVLengthMm(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "V Gap (mm)" }), /*#__PURE__*/
          _jsx(ZInput, { value: vGapMm, onChange: (e) => setVGapMm(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "WC\u2192WR distance (mm)" }), /*#__PURE__*/
          _jsx(ZInput, { value: wcToWr, onChange: (e) => setWcToWr(e.target.value), disabled: disabled })] }
        )] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "form-row", children: [/*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Weld Dia (mm)" }), /*#__PURE__*/
          _jsx(ZInput, { value: weldDiaMm, onChange: (e) => setWeldDiaMm(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Coolant conc %" }), /*#__PURE__*/
          _jsx(ZInput, { value: coolantConcPct, onChange: (e) => setCoolantConcPct(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Coolant pressure (kg)" }), /*#__PURE__*/
          _jsx(ZInput, {
            value: coolantPressureKg,
            onChange: (e) => setCoolantPressureKg(e.target.value),
            disabled: disabled }
          )] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Weld flow / surface / V angle" }), /*#__PURE__*/
          _jsx(ZInput, {
            value: weldFlowSurfaceVangle,
            onChange: (e) => setWeldFlowSurfaceVangle(e.target.value),
            disabled: disabled }
          )] }
        )] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "form-row", children: [/*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Fin pass FF1" }), /*#__PURE__*/
          _jsx(ZInput, { value: ff1, onChange: (e) => setFf1(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Fin pass FF2" }), /*#__PURE__*/
          _jsx(ZInput, { value: ff2, onChange: (e) => setFf2(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "Fin pass FF3" }), /*#__PURE__*/
          _jsx(ZInput, { value: ff3, onChange: (e) => setFf3(e.target.value), disabled: disabled })] }
        )] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "form-row", children: [/*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "First-off OD mm" }), /*#__PURE__*/
          _jsx(ZInput, { value: firstOffOd, onChange: (e) => setFirstOffOd(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "First-off THK mm" }), /*#__PURE__*/
          _jsx(ZInput, { value: firstOffThk, onChange: (e) => setFirstOffThk(e.target.value), disabled: disabled })] }
        ), /*#__PURE__*/
        _jsxs("div", { children: [/*#__PURE__*/
          _jsx("label", { children: "4M category" }), /*#__PURE__*/
          _jsxs(ZSelect, {
            value: m4Category,
            onChange: (e) => setM4Category(e.target.value),
            disabled: disabled || !is4mChange, children: [/*#__PURE__*/

            _jsx("option", { value: "", children: "\u2014" }), /*#__PURE__*/
            _jsx("option", { value: "MAN", children: "MAN" }), /*#__PURE__*/
            _jsx("option", { value: "MATERIAL", children: "MATERIAL" }), /*#__PURE__*/
            _jsx("option", { value: "MACHINE", children: "MACHINE" }), /*#__PURE__*/
            _jsx("option", { value: "METHOD", children: "METHOD" })] }
          )] }
        )] }
      ), /*#__PURE__*/
      _jsxs("div", { className: "form-row", children: [/*#__PURE__*/
        _jsxs("div", { className: "confirm-row", children: [/*#__PURE__*/
          _jsx("input", { type: "checkbox", checked: argonUsed, onChange: (e) => setArgonUsed(e.target.checked), disabled: disabled }), /*#__PURE__*/
          _jsx("span", { children: "Argon used" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "confirm-row", children: [/*#__PURE__*/
          _jsx("input", { type: "checkbox", checked: wiperUsed, onChange: (e) => setWiperUsed(e.target.checked), disabled: disabled }), /*#__PURE__*/
          _jsx("span", { children: "Wiper used" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "confirm-row", children: [/*#__PURE__*/
          _jsx("input", {
            type: "checkbox",
            checked: weldFlowOk,
            onChange: (e) => setWeldFlowOk(e.target.checked),
            disabled: disabled }
          ), /*#__PURE__*/
          _jsx("span", { children: "Bead / weld-flow OK" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "confirm-row", children: [/*#__PURE__*/
          _jsx("input", {
            type: "checkbox",
            checked: ectCalibrated,
            onChange: (e) => setEctCalibrated(e.target.checked),
            disabled: disabled }
          ), /*#__PURE__*/
          _jsx("span", { children: "ECT calibrated" })] }
        ), /*#__PURE__*/
        _jsxs("div", { className: "confirm-row", children: [/*#__PURE__*/
          _jsx("input", {
            type: "checkbox",
            checked: is4mChange,
            onChange: (e) => setIs4mChange(e.target.checked),
            disabled: disabled }
          ), /*#__PURE__*/
          _jsx("span", { children: "4M change" })] }
        )] }
      ), /*#__PURE__*/
      _jsx("div", { className: "btn-row", children: /*#__PURE__*/
        _jsx(ZButton, { variant: "primary", disabled: disabled || !allConfirmed || busy, onClick: () => void handleSubmit(), children: "Confirm Setup" }

        ) }
      ),
      error && /*#__PURE__*/_jsx("p", { className: "error-text", children: error })] }
    ));

}
