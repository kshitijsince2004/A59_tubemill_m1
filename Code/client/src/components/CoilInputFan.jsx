import { useState } from 'react';
import { ZButton, ZInput } from '../ui';
import FormModal from './FormModal';

export default function CoilInputFan({ coils, onAdd, disabled }) {
  const [open, setOpen] = useState(false);
  const [coilTag, setCoilTag] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [spliceSeq, setSpliceSeq] = useState(String(coils.length + 1));
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [hardness, setHardness] = useState('');
  const [widthS, setWidthS] = useState('');
  const [widthM, setWidthM] = useState('');
  const [widthE, setWidthE] = useState('');
  const [thkS, setThkS] = useState('');
  const [thkM, setThkM] = useState('');
  const [thkE, setThkE] = useState('');
  const [rejection, setRejection] = useState('');
  const [busy, setBusy] = useState(false);

  function resetForm(nextSeq) {
    setCoilTag('');
    setWeightKg('');
    setWorkOrderNo('');
    setHardness('');
    setWidthS('');
    setWidthM('');
    setWidthE('');
    setThkS('');
    setThkM('');
    setThkE('');
    setRejection('');
    setSpliceSeq(String(nextSeq));
  }

  function openForm() {
    setSpliceSeq(String(coils.length + 1));
    setOpen(true);
  }

  async function handleAdd() {
    if (!coilTag.trim()) return;
    setBusy(true);
    try {
      await onAdd({
        coilTag: coilTag.trim(),
        inputWeightKg: weightKg ? Number(weightKg) : undefined,
        spliceSeq: Number(spliceSeq),
        workOrderNo: workOrderNo || undefined,
        slitHardness: hardness ? Number(hardness) : undefined,
        widthSMm: widthS ? Number(widthS) : undefined,
        widthMMm: widthM ? Number(widthM) : undefined,
        widthEMm: widthE ? Number(widthE) : undefined,
        thkSMm: thkS ? Number(thkS) : undefined,
        thkMMm: thkM ? Number(thkM) : undefined,
        thkEMm: thkE ? Number(thkE) : undefined,
        rejectionRemark: rejection || undefined,
      });
      resetForm(coils.length + 2);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <header className="panel__header">
        <h2 style={{ margin: 0 }}>Coil Input Fan</h2>
        <ZButton variant="primary" disabled={disabled} onClick={openForm}>
          Add Coil
        </ZButton>
      </header>

      {coils.length > 0 ? (
        <table className="table" style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>Seq</th>
              <th>Coil Tag</th>
              <th>Weight</th>
              <th>Hardness</th>
              <th>W S/M/E</th>
              <th>T S/M/E</th>
            </tr>
          </thead>
          <tbody>
            {coils.map((c) => (
              <tr key={String(c.id ?? c.coil_tag)}>
                <td>{String(c.splice_seq ?? '—')}</td>
                <td className="font-mono">{String(c.coil_tag ?? '—')}</td>
                <td>{String(c.input_weight_kg ?? '—')}</td>
                <td>{String(c.slit_hardness ?? '—')}</td>
                <td className="font-mono">
                  {[c.width_s_mm, c.width_m_mm, c.width_e_mm].map((v) => v ?? '—').join('/')}
                </td>
                <td className="font-mono">
                  {[c.thk_s_mm, c.thk_m_mm, c.thk_e_mm].map((v) => v ?? '—').join('/')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-hint">No coils yet. Use Add Coil to enter input.</p>
      )}

      <FormModal
        open={open}
        eyebrow="Coil input"
        title="Add coil"
        description="Enter slit / coil details for this production run."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ZButton variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </ZButton>
            <ZButton
              variant="primary"
              disabled={disabled || busy || !coilTag.trim()}
              onClick={() => void handleAdd()}
            >
              {busy ? 'Saving…' : 'Save coil'}
            </ZButton>
          </>
        }
      >
        <div className="form-row">
          <div>
            <label>Coil Tag</label>
            <ZInput
              value={coilTag}
              onChange={(e) => setCoilTag(e.target.value)}
              disabled={disabled || busy}
              autoFocus
            />
          </div>
          <div>
            <label>Input Weight (kg)</label>
            <ZInput
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
          <div>
            <label>WO (slit)</label>
            <ZInput
              value={workOrderNo}
              onChange={(e) => setWorkOrderNo(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>Splice Seq</label>
            <ZInput
              value={spliceSeq}
              onChange={(e) => setSpliceSeq(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
          <div>
            <label>Slit hardness</label>
            <ZInput
              value={hardness}
              onChange={(e) => setHardness(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
          <div>
            <label>Rejection remark</label>
            <ZInput
              value={rejection}
              onChange={(e) => setRejection(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>Width S/M/E</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <ZInput
                placeholder="S"
                value={widthS}
                onChange={(e) => setWidthS(e.target.value)}
                disabled={disabled || busy}
              />
              <ZInput
                placeholder="M"
                value={widthM}
                onChange={(e) => setWidthM(e.target.value)}
                disabled={disabled || busy}
              />
              <ZInput
                placeholder="E"
                value={widthE}
                onChange={(e) => setWidthE(e.target.value)}
                disabled={disabled || busy}
              />
            </div>
          </div>
          <div>
            <label>THK S/M/E</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <ZInput
                placeholder="S"
                value={thkS}
                onChange={(e) => setThkS(e.target.value)}
                disabled={disabled || busy}
              />
              <ZInput
                placeholder="M"
                value={thkM}
                onChange={(e) => setThkM(e.target.value)}
                disabled={disabled || busy}
              />
              <ZInput
                placeholder="E"
                value={thkE}
                onChange={(e) => setThkE(e.target.value)}
                disabled={disabled || busy}
              />
            </div>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
