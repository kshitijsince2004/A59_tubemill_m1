import { useState } from 'react';
import { ZButton, ZInput, ZSelect } from '../ui';
import FormModal from './FormModal';

export default function OnlineInspectionPanel({ inspections, onAdd, disabled }) {
  const [open, setOpen] = useState(false);
  const [lotCoilRef, setLotCoilRef] = useState('');
  const [workOrderNo, setWorkOrderNo] = useState('');
  const [odMm, setOdMm] = useState('');
  const [thkMm, setThkMm] = useState('');
  const [lengthMm, setLengthMm] = useState('');
  const [ovalityMm, setOvalityMm] = useState('');
  const [straightnessMm, setStraightnessMm] = useState('');
  const [qaClass, setQaClass] = useState('PRIME');
  const [utEct, setUtEct] = useState('');
  const [weldBeadOk, setWeldBeadOk] = useState(true);
  const [flatteningOk, setFlatteningOk] = useState(true);
  const [driftingOk, setDriftingOk] = useState(true);
  const [surfaceOk, setSurfaceOk] = useState(true);
  const [gaugeOk, setGaugeOk] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setLotCoilRef('');
    setWorkOrderNo('');
    setOdMm('');
    setThkMm('');
    setLengthMm('');
    setOvalityMm('');
    setStraightnessMm('');
    setUtEct('');
    setRemarks('');
    setQaClass('PRIME');
    setWeldBeadOk(true);
    setFlatteningOk(true);
    setDriftingOk(true);
    setSurfaceOk(true);
    setGaugeOk(true);
  }

  async function handleAdd() {
    setBusy(true);
    try {
      await onAdd({
        lotCoilRef: lotCoilRef || undefined,
        workOrderNo: workOrderNo || undefined,
        odMm: odMm ? Number(odMm) : undefined,
        thkMm: thkMm ? Number(thkMm) : undefined,
        lengthMm: lengthMm ? Number(lengthMm) : undefined,
        ovalityMm: ovalityMm ? Number(ovalityMm) : undefined,
        straightnessMm: straightnessMm ? Number(straightnessMm) : undefined,
        qaClass,
        utEctResult: utEct || undefined,
        weldBeadOk,
        flatteningOk,
        driftingOk,
        surfaceOk,
        gaugeOk,
        remarks: remarks || undefined,
      });
      resetForm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <header className="panel__header">
        <h2 style={{ margin: 0 }}>Online inspection</h2>
        <ZButton variant="primary" disabled={disabled} onClick={() => setOpen(true)}>
          Add inspection
        </ZButton>
      </header>

      {inspections.length > 0 ? (
        <table className="table" style={{ marginTop: '0.75rem' }}>
          <thead>
            <tr>
              <th>Lot/coil</th>
              <th>OD</th>
              <th>THK</th>
              <th>Len</th>
              <th>Oval</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {inspections.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.lot_coil_ref ?? '—')}</td>
                <td>{String(r.od_mm ?? '—')}</td>
                <td>{String(r.thk_mm ?? '—')}</td>
                <td>{String(r.length_mm ?? '—')}</td>
                <td>{String(r.ovality_mm ?? '—')}</td>
                <td>{String(r.qa_class ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-hint">No inspections yet. Use Add inspection to record.</p>
      )}

      <FormModal
        open={open}
        eyebrow="Online inspection"
        title="Add inspection"
        description="Record dimensional / weld checks for the current run."
        onClose={() => setOpen(false)}
        footer={
          <>
            <ZButton variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </ZButton>
            <ZButton
              variant="primary"
              disabled={disabled || busy}
              onClick={() => void handleAdd()}
            >
              {busy ? 'Saving…' : 'Save inspection'}
            </ZButton>
          </>
        }
      >
        <div className="form-row">
          <div>
            <label>Lot / coil</label>
            <ZInput
              value={lotCoilRef}
              onChange={(e) => setLotCoilRef(e.target.value)}
              disabled={disabled || busy}
              autoFocus
            />
          </div>
          <div>
            <label>WO</label>
            <ZInput
              value={workOrderNo}
              onChange={(e) => setWorkOrderNo(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
          <div>
            <label>QA class</label>
            <ZSelect
              value={qaClass}
              onChange={(e) => setQaClass(e.target.value)}
              disabled={disabled || busy}
            >
              <option value="PRIME">PRIME</option>
              <option value="PQ2">PQ2</option>
              <option value="CQ">CQ</option>
              <option value="OPEN">OPEN</option>
              <option value="SCRAP">SCRAP</option>
            </ZSelect>
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>OD mm</label>
            <ZInput value={odMm} onChange={(e) => setOdMm(e.target.value)} disabled={disabled || busy} />
          </div>
          <div>
            <label>THK mm</label>
            <ZInput value={thkMm} onChange={(e) => setThkMm(e.target.value)} disabled={disabled || busy} />
          </div>
          <div>
            <label>Length mm</label>
            <ZInput
              value={lengthMm}
              onChange={(e) => setLengthMm(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label>Ovality mm</label>
            <ZInput
              value={ovalityMm}
              onChange={(e) => setOvalityMm(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
          <div>
            <label>Straightness mm</label>
            <ZInput
              value={straightnessMm}
              onChange={(e) => setStraightnessMm(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
          <div>
            <label>UT/ECT</label>
            <ZInput value={utEct} onChange={(e) => setUtEct(e.target.value)} disabled={disabled || busy} />
          </div>
        </div>
        <div className="form-row">
          {[
            ['Weld bead OK', weldBeadOk, setWeldBeadOk],
            ['Flattening OK', flatteningOk, setFlatteningOk],
            ['Drifting OK', driftingOk, setDriftingOk],
            ['Surface OK', surfaceOk, setSurfaceOk],
            ['Gauge OK', gaugeOk, setGaugeOk],
          ].map(([label, val, set]) => (
            <div className="confirm-row" key={label}>
              <input
                type="checkbox"
                checked={val}
                onChange={(e) => set(e.target.checked)}
                disabled={disabled || busy}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="form-row">
          <div style={{ flex: 1 }}>
            <label>Remarks</label>
            <ZInput
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={disabled || busy}
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
