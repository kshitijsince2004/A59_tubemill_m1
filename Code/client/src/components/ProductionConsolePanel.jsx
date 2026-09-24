import { useEffect, useState } from 'react';
import { ZBadge, ZInput, statusTone } from '../ui';

function displayValue(value, suffix = '') {
  if (value == null || value === '') return '—';
  return `${value}${suffix}`;
}

function displayMt(value) {
  if (value == null || value === '') return '—';
  return `${Number(value).toFixed(3)} MT`;
}

function sizePart(size, key) {
  if (!size || size[key] == null || size[key] === '') return null;
  return size[key];
}

function parseOptionalInt(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function parseOptionalMt(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/**
 * Work Order canvas — summary (read-only) + production entry (editable).
 */
export default function ProductionConsolePanel({
  run,
  busy = false,
  disabled = false,
  onSaveProduction,
}) {
  const production = run.production ?? {};
  const size = run.size ?? {};
  const locked =
    disabled ||
    run.runState === 'RUN_COMPLETE' ||
    ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(run.status);

  const [draft, setDraft] = useState({
    primeNo: '',
    pq2JointNo: '',
    pq2OtherNo: '',
    cqNo: '',
    openNo: '',
    scrapWtMt: '',
  });
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDraft({
      primeNo: production.primeNo != null ? String(production.primeNo) : '',
      pq2JointNo: production.pq2JointNo != null ? String(production.pq2JointNo) : '',
      pq2OtherNo: production.pq2OtherNo != null ? String(production.pq2OtherNo) : '',
      cqNo: production.cqNo != null ? String(production.cqNo) : '',
      openNo: production.openNo != null ? String(production.openNo) : '',
      scrapWtMt: production.scrapWtMt != null ? String(production.scrapWtMt) : '',
    });
  }, [
    run.id,
    production.primeNo,
    production.pq2JointNo,
    production.pq2OtherNo,
    production.cqNo,
    production.openNo,
    production.scrapWtMt,
  ]);

  async function saveField(partial) {
    if (locked || !onSaveProduction) return;
    setSaveError('');
    try {
      await onSaveProduction(partial);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  function onCountBlur(field, raw) {
    const parsed = parseOptionalInt(raw);
    if (parsed === undefined) {
      setSaveError('Enter a whole number ≥ 0, or leave blank');
      return;
    }
    const current = production[field] ?? null;
    if (parsed === current) return;
    void saveField({ [field]: parsed });
  }

  function onScrapBlur(raw) {
    const parsed = parseOptionalMt(raw);
    if (parsed === undefined) {
      setSaveError('Enter a weight ≥ 0 MT, or leave blank');
      return;
    }
    const current = production.scrapWtMt ?? null;
    if (parsed === current) return;
    void saveField({ scrapWtMt: parsed });
  }

  const od = sizePart(size, 'odMm') ?? sizePart(size, 'equivOdMm');
  const thk = sizePart(size, 'thkMm');
  const length = sizePart(size, 'lengthMm');

  return (
    <>
      <section className="panel tm-order-card">
        <header className="panel__header">
          <h2 style={{ margin: 0 }}>Work order summary</h2>
          <ZBadge tone={statusTone(run.runState)}>
            {String(run.runState ?? '').replace(/_/g, ' ')}
          </ZBadge>
        </header>
        <div className="meta-grid">
          <div className="meta-grid__item">
            <label>Work order</label>
            <div className="value font-mono">{displayValue(run.workOrderNo)}</div>
          </div>
          <div className="meta-grid__item">
            <label>Batch</label>
            <div className="value font-mono">{displayValue(run.bcBatchNumber)}</div>
          </div>
          <div className="meta-grid__item">
            <label>Customer</label>
            <div className="value">{displayValue(run.customerCode)}</div>
          </div>
          <div className="meta-grid__item">
            <label>Grade</label>
            <div className="value font-mono">{displayValue(run.gradeCode)}</div>
          </div>
          <div className="meta-grid__item">
            <label>Size key</label>
            <div className="value font-mono">{displayValue(run.sizeKey)}</div>
          </div>
          <div className="meta-grid__item">
            <label>OD</label>
            <div className="value font-mono">{od != null ? `${od} mm` : '—'}</div>
          </div>
          <div className="meta-grid__item">
            <label>THK</label>
            <div className="value font-mono">{thk != null ? `${thk} mm` : '—'}</div>
          </div>
          <div className="meta-grid__item">
            <label>Length</label>
            <div className="value font-mono">{length != null ? `${length} mm` : '—'}</div>
          </div>
          <div className="meta-grid__item">
            <label>Slit No.</label>
            <div className="value font-mono">{displayValue(run.slitNo)}</div>
          </div>
          <div className="meta-grid__item">
            <label>Hold</label>
            <div className="value font-mono">{displayValue(run.holdStatus)}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Production entry</h2>
        {saveError ? <p className="error-text">{saveError}</p> : null}
        <table className="prod-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>No. (pcs)</th>
              <th>Wt. (MT)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PRIME</td>
              <td>
                <ZInput
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={locked || busy}
                  value={draft.primeNo}
                  placeholder="—"
                  onChange={(e) => setDraft((d) => ({ ...d, primeNo: e.target.value }))}
                  onBlur={(e) => onCountBlur('primeNo', e.target.value)}
                  aria-label="Prime No."
                />
              </td>
              <td className="font-mono readonly-cell">{displayMt(production.primeWtMt)}</td>
            </tr>
            <tr>
              <td>PQ2 — JOINT</td>
              <td>
                <ZInput
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={locked || busy}
                  value={draft.pq2JointNo}
                  placeholder="—"
                  onChange={(e) => setDraft((d) => ({ ...d, pq2JointNo: e.target.value }))}
                  onBlur={(e) => onCountBlur('pq2JointNo', e.target.value)}
                  aria-label="PQ2 Joint No."
                />
              </td>
              <td className="font-mono readonly-cell">{displayMt(production.pq2JointWtMt)}</td>
            </tr>
            <tr>
              <td>PQ2 — OTHER</td>
              <td>
                <ZInput
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={locked || busy}
                  value={draft.pq2OtherNo}
                  placeholder="—"
                  onChange={(e) => setDraft((d) => ({ ...d, pq2OtherNo: e.target.value }))}
                  onBlur={(e) => onCountBlur('pq2OtherNo', e.target.value)}
                  aria-label="PQ2 Other No."
                />
              </td>
              <td className="font-mono readonly-cell">{displayMt(production.pq2OtherWtMt)}</td>
            </tr>
            <tr>
              <td>CQ</td>
              <td>
                <ZInput
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={locked || busy}
                  value={draft.cqNo}
                  placeholder="—"
                  onChange={(e) => setDraft((d) => ({ ...d, cqNo: e.target.value }))}
                  onBlur={(e) => onCountBlur('cqNo', e.target.value)}
                  aria-label="CQ No."
                />
              </td>
              <td className="font-mono readonly-cell">{displayMt(production.cqWtMt)}</td>
            </tr>
            <tr>
              <td>OPEN</td>
              <td>
                <ZInput
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={locked || busy}
                  value={draft.openNo}
                  placeholder="—"
                  onChange={(e) => setDraft((d) => ({ ...d, openNo: e.target.value }))}
                  onBlur={(e) => onCountBlur('openNo', e.target.value)}
                  aria-label="Open No."
                />
              </td>
              <td className="font-mono readonly-cell">{displayMt(production.openWtMt)}</td>
            </tr>
            <tr>
              <td>SCRAP</td>
              <td className="font-mono readonly-cell">—</td>
              <td>
                {locked ? (
                  <span className="font-mono readonly-cell">
                    {displayMt(production.scrapWtMt ?? run.totalScrapMt)}
                  </span>
                ) : (
                  <ZInput
                    type="number"
                    min={0}
                    step="0.001"
                    inputMode="decimal"
                    disabled={busy}
                    value={draft.scrapWtMt}
                    placeholder="MT"
                    onChange={(e) => setDraft((d) => ({ ...d, scrapWtMt: e.target.value }))}
                    onBlur={(e) => onScrapBlur(e.target.value)}
                    aria-label="Scrap Wt MT"
                  />
                )}
              </td>
            </tr>
            <tr className="prod-table__total">
              <td>TOTAL</td>
              <td className="font-mono readonly-cell">{displayValue(production.totalNo)}</td>
              <td className="font-mono readonly-cell">{displayMt(production.totalWtMt)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
