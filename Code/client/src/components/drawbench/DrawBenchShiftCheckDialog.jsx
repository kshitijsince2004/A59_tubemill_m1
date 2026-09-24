import { useEffect, useState } from 'react';
import FormModal from '../FormModal';
import { ZButton, ZInput } from '../../ui';

const DEFAULTS = {
  cleanOk: true,
  diePlugOk: true,
  lubeOk: true,
  pressureOk: true,
  inputLubeOk: true,
  noiseOk: true,
  drawSpeedSet: '',
  remarks: '',
};

/**
 * Operator shift check before / during production (StatusRail SHIFT CHECK).
 */
export default function DrawBenchShiftCheckDialog({
  open,
  busy = false,
  benchCode = '',
  shiftRef = 'A',
  error = '',
  onClose,
  onConfirm,
}) {
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    if (!open) return;
    setForm({ ...DEFAULTS });
  }, [open]);

  function toggle(key) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  const checks = [
    { key: 'cleanOk', label: 'Clean OK' },
    { key: 'diePlugOk', label: 'Die / plug OK' },
    { key: 'lubeOk', label: 'Lube OK' },
    { key: 'pressureOk', label: 'Pressure OK' },
    { key: 'inputLubeOk', label: 'Input lube OK' },
    { key: 'noiseOk', label: 'Noise OK' },
  ];

  return (
    <FormModal
      open={open}
      eyebrow="Production"
      title="Shift check"
      description={
        benchCode
          ? `Record shift check for ${benchCode} · Shift ${shiftRef || 'A'}`
          : 'Record Draw Bench shift check'
      }
      onClose={() => {
        if (!busy) onClose?.();
      }}
      preventScrimClose={busy}
      footer={
        <>
          <ZButton variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </ZButton>
          <ZButton
            variant="primary"
            disabled={busy || !benchCode}
            onClick={() =>
              onConfirm?.({
                benchCode,
                shiftRef: shiftRef || 'A',
                cleanOk: form.cleanOk,
                diePlugOk: form.diePlugOk,
                lubeOk: form.lubeOk,
                pressureOk: form.pressureOk,
                inputLubeOk: form.inputLubeOk,
                noiseOk: form.noiseOk,
                drawSpeedSet:
                  form.drawSpeedSet === '' ? undefined : Number(form.drawSpeedSet),
                remarks: form.remarks || undefined,
              })
            }
          >
            {busy ? 'Saving…' : 'Save shift check'}
          </ZButton>
        </>
      }
    >
      {error ? <p className="banner banner--error">{error}</p> : null}
      <div className="form-grid">
        {checks.map((c) => (
          <label key={c.key} className="db-shift-check__toggle">
            <input
              type="checkbox"
              checked={Boolean(form[c.key])}
              disabled={busy}
              onChange={() => toggle(c.key)}
            />
            <span>{c.label}</span>
          </label>
        ))}
        <label>
          Draw speed set
          <ZInput
            type="number"
            value={form.drawSpeedSet}
            disabled={busy}
            onChange={(e) => setForm((f) => ({ ...f, drawSpeedSet: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        <label className="span-2">
          Remarks
          <ZInput
            value={form.remarks}
            disabled={busy}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          />
        </label>
      </div>
    </FormModal>
  );
}
