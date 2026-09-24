/**
 * Draw Bench production console — production data entry only.
 * Lifecycle (Start / Stoppage / End+Submit) lives on StatusRail / ActionRail.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { drawBenchApi } from '../../api/processApi';
import { ZButton, ZInput, ZSelect, ZBadge, statusTone } from '../../ui';
import { validateProcessForm } from '../../lib/validateForm';

function displayVal(v, suffix = '') {
  if (v == null || v === '') return '—';
  return `${v}${suffix}`;
}

function formatFinalSize(form) {
  const parts = [form.finalOd, form.finalId, form.finalThk, form.finalLen].filter(
    (x) => x !== '' && x != null
  );
  if (!parts.length) return '—';
  return `${form.finalOd || '—'} / ${form.finalId || '—'} / ${form.finalThk || '—'} / ${form.finalLen || '—'} mm`;
}

const emptyForm = () => ({
  lotNo: `DB-${Date.now().toString(36).toUpperCase()}`,
  benchCode: 'DB-40T',
  drawPass: '1ST',
  workOrderNo: '',
  customerCode: '',
  customerName: '',
  gradeCode: '',
  inputTubeRef: '',
  operatorRef: '',
  supervisorRef: '',
  shiftInchargeRef: '',
  stage: 'INTER',
  fromOd: '',
  fromThk: '',
  fromLen: '',
  toOd: '',
  toId: '',
  toThk: '',
  toLen: '',
  finalOd: '',
  finalId: '',
  finalThk: '',
  finalLen: '',
  drawPlanLenMm: '',
  acceptedPcs: '',
  acceptedMt: '',
  rejectedPcs: '',
  drawnMetre: '',
  breakdownRemark: '',
  shiftRef: 'A',
  prodDate: new Date().toISOString().slice(0, 10),
  remarks: '',
  materialLotId: '',
  upstreamHandoffId: '',
});

function FieldLabel({ children }) {
  return <span className="db-field-label">{children}</span>;
}

function MetaItem({ label, children, mono = false }) {
  return (
    <div className="meta-grid__item">
      <label>{label}</label>
      <div className={`value${mono ? ' font-mono' : ''}`}>{children}</div>
    </div>
  );
}

export default function DrawBenchConsole({
  selectedId,
  onSelectedId,
  isWritable,
  onBackToBoard,
  onGoToOrders,
  onLotMeta,
  initialBenchCode,
  runStatus,
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');

  const { data: detail } = useQuery({
    queryKey: ['drw-lot', selectedId],
    queryFn: () => drawBenchApi.getLot(selectedId),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (initialBenchCode && !selectedId) {
      setForm((f) => ({ ...f, benchCode: initialBenchCode }));
    }
  }, [initialBenchCode, selectedId]);

  useEffect(() => {
    if (!detail) return;
    const fromSize = detail.fromSize ?? {};
    const toSize = detail.toSize ?? {};
    const finalSize = detail.finalSize ?? {};
    setForm((f) => ({
      ...f,
      lotNo: String(detail.lotNo ?? f.lotNo),
      benchCode: String(detail.benchCode ?? f.benchCode),
      drawPass: String(detail.drawPass ?? '1ST'),
      workOrderNo: String(detail.workOrderNo ?? ''),
      customerCode: String(detail.customerCode ?? ''),
      customerName: String(detail.customerName ?? ''),
      gradeCode: String(detail.gradeCode ?? ''),
      inputTubeRef: String(detail.inputTubeRef ?? ''),
      operatorRef: String(detail.operatorRef ?? ''),
      supervisorRef: String(detail.supervisorRef ?? ''),
      shiftInchargeRef: String(detail.shiftInchargeRef ?? ''),
      stage: String(detail.stage ?? detail.passType ?? 'INTER'),
      fromOd:
        detail.fromOdMm != null
          ? String(detail.fromOdMm)
          : fromSize.odMm != null
            ? String(fromSize.odMm)
            : '',
      fromThk:
        detail.fromThMm != null
          ? String(detail.fromThMm)
          : fromSize.thkMm != null
            ? String(fromSize.thkMm)
            : '',
      fromLen:
        detail.fromLenMm != null
          ? String(detail.fromLenMm)
          : fromSize.lengthMm != null
            ? String(fromSize.lengthMm)
            : '',
      toOd:
        detail.toOdMm != null
          ? String(detail.toOdMm)
          : toSize.odMm != null
            ? String(toSize.odMm)
            : '',
      toId:
        detail.toIdMm != null
          ? String(detail.toIdMm)
          : toSize.idMm != null
            ? String(toSize.idMm)
            : '',
      toThk:
        detail.toThMm != null
          ? String(detail.toThMm)
          : toSize.thkMm != null
            ? String(toSize.thkMm)
            : '',
      toLen:
        detail.toLenMm != null
          ? String(detail.toLenMm)
          : toSize.lengthMm != null
            ? String(toSize.lengthMm)
            : '',
      finalOd:
        detail.finalOdMm != null
          ? String(detail.finalOdMm)
          : finalSize.odMm != null
            ? String(finalSize.odMm)
            : '',
      finalId:
        detail.finalIdMm != null
          ? String(detail.finalIdMm)
          : finalSize.idMm != null
            ? String(finalSize.idMm)
            : '',
      finalThk:
        detail.finalThMm != null
          ? String(detail.finalThMm)
          : finalSize.thkMm != null
            ? String(finalSize.thkMm)
            : '',
      finalLen:
        detail.finalLenMm != null
          ? String(detail.finalLenMm)
          : finalSize.lengthMm != null
            ? String(finalSize.lengthMm)
            : '',
      acceptedPcs: detail.acceptedPcs != null ? String(detail.acceptedPcs) : '',
      acceptedMt: detail.acceptedMt != null ? String(detail.acceptedMt) : '',
      rejectedPcs: detail.rejectedPcs != null ? String(detail.rejectedPcs) : '',
      drawnMetre: detail.drawnMetre != null ? String(detail.drawnMetre) : '',
      drawPlanLenMm: detail.drawPlanLenMm != null ? String(detail.drawPlanLenMm) : '',
      breakdownRemark: String(detail.breakdownRemark ?? ''),
      remarks: String(detail.remarks ?? ''),
      shiftRef: String(detail.shiftRef ?? 'A'),
      prodDate: detail.prodDate ? String(detail.prodDate).slice(0, 10) : f.prodDate,
      materialLotId: String(detail.materialLotId ?? ''),
      upstreamHandoffId: String(detail.upstreamHandoffId ?? ''),
    }));
    onLotMeta?.({
      workOrderNo: detail.workOrderNo ?? '',
      status: detail.status ?? '',
      benchCode: detail.benchCode ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-running on new onLotMeta identity
  }, [detail]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function num(v) {
    return v === '' ? undefined : Number(v);
  }

  function payload() {
    return {
      lotNo: form.lotNo,
      benchCode: form.benchCode,
      drawPass: form.drawPass,
      workOrderNo: form.workOrderNo || undefined,
      customerCode: form.customerCode || undefined,
      customerName: form.customerName || undefined,
      gradeCode: form.gradeCode || undefined,
      inputTubeRef: form.inputTubeRef || undefined,
      operatorRef: form.operatorRef || undefined,
      supervisorRef: form.supervisorRef || undefined,
      shiftInchargeRef: form.shiftInchargeRef || undefined,
      stage: form.stage,
      passType: form.stage,
      fromSize: {
        odMm: num(form.fromOd),
        thkMm: num(form.fromThk),
        lengthMm: num(form.fromLen),
      },
      toSize: {
        odMm: num(form.toOd),
        idMm: num(form.toId),
        thkMm: num(form.toThk),
        lengthMm: num(form.toLen),
      },
      finalSize: {
        odMm: num(form.finalOd),
        idMm: num(form.finalId),
        thkMm: num(form.finalThk),
        lengthMm: num(form.finalLen),
      },
      fromOdMm: num(form.fromOd),
      fromThMm: num(form.fromThk),
      fromLenMm: num(form.fromLen),
      toOdMm: num(form.toOd),
      toIdMm: num(form.toId),
      toThMm: num(form.toThk),
      toLenMm: num(form.toLen),
      finalOdMm: num(form.finalOd),
      finalIdMm: num(form.finalId),
      finalThMm: num(form.finalThk),
      finalLenMm: num(form.finalLen),
      acceptedPcs: num(form.acceptedPcs),
      acceptedMt: num(form.acceptedMt),
      rejectedPcs: num(form.rejectedPcs),
      drawnMetre: num(form.drawnMetre),
      drawPlanLenMm: num(form.drawPlanLenMm),
      breakdownRemark: form.breakdownRemark || undefined,
      remarks: form.remarks || undefined,
      shiftRef: form.shiftRef || undefined,
      prodDate: form.prodDate || undefined,
      materialLotId: form.materialLotId || undefined,
      upstreamHandoffId: form.upstreamHandoffId || undefined,
    };
  }

  async function saveDraft() {
    setErr('');
    setMsg('');
    setWarn('');
    try {
      if (!form.workOrderNo?.trim()) {
        setErr('Work Order is required — assign or load a work order before saving');
        return;
      }
      const body = payload();
      const v = validateProcessForm('DRW', body);
      if (!v.ok) {
        setErr(v.errors.map((e) => e.message).join('; '));
        return;
      }
      if (v.warnings?.length) setWarn(v.warnings.map((w) => w.message).join('; '));
      let lot;
      if (selectedId) {
        lot = await drawBenchApi.updateLot(selectedId, body);
      } else {
        lot = await drawBenchApi.createLot(body);
        onSelectedId?.(lot.id);
      }
      await qc.invalidateQueries({ queryKey: ['drw-lots'] });
      await qc.invalidateQueries({ queryKey: ['drw-board'] });
      await qc.invalidateQueries({ queryKey: ['drw-lot', lot.id] });
      setMsg('Production data saved');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    }
  }

  const lotStatus = detail?.status ?? 'DRAFT';
  const locked = lotStatus === 'APPROVED' || lotStatus === 'SUBMITTED';
  const noActiveWo = !form.workOrderNo;
  const batchLabel = form.inputTubeRef || form.lotNo || '';
  const headerStatus = runStatus || lotStatus;

  return (
    <div className="db-console capture-workspace">
      <header className="process-header db-console__process-header">
        <div className="process-header__meta">
          <h2 className="process-header__title">Work Order</h2>
          {form.workOrderNo ? (
            <span className="font-mono process-header__wo" title={form.workOrderNo}>
              {form.workOrderNo}
              {form.drawPass ? ` · ${form.drawPass}` : ''}
            </span>
          ) : (
            <span className="font-mono process-header__run">{form.lotNo || 'New lot'}</span>
          )}
          {form.benchCode ? <ZBadge tone="idle">{form.benchCode}</ZBadge> : null}
          <ZBadge tone={statusTone(String(headerStatus))}>
            {String(headerStatus).replace(/_/g, ' ')}
          </ZBadge>
          {batchLabel ? <span className="db-console__batch">Batch {batchLabel}</span> : null}
        </div>
        <div className="db-console__header-actions">
          {onBackToBoard ? (
            <ZButton variant="ghost" className="db-console__order-details" onClick={onBackToBoard}>
              Back to board
            </ZButton>
          ) : null}
          {onBackToBoard ? (
            <button
              type="button"
              className="process-header__close"
              onClick={onBackToBoard}
              aria-label="Close"
            >
              ✕
            </button>
          ) : null}
        </div>
      </header>

      <div className="capture-workspace__body db-console__body">
        {noActiveWo ? (
          <div className="db-console--empty">
            <p className="banner banner--warn">
              <strong>NO ACTIVE WORK ORDER</strong>
            </p>
            <p className="muted">
              Load a work order from the Work Order tab or use Load order on an idle bench.
            </p>
            <div className="btn-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              {onGoToOrders ? (
                <ZButton variant="primary" onClick={onGoToOrders}>
                  Go to Work Order
                </ZButton>
              ) : null}
              {onBackToBoard ? (
                <ZButton variant="ghost" onClick={onBackToBoard}>
                  Back to board
                </ZButton>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {msg ? <p className="banner banner--ok">{msg}</p> : null}
            {warn ? <p className="banner banner--warn">{warn}</p> : null}
            {err ? <p className="banner banner--error">{err}</p> : null}

            <section className="panel db-console__order-card">
              <div className="db-console__order-card-head">
                <h2>
                  Current Order {form.workOrderNo || '—'}
                  {form.drawPass ? ` ${form.drawPass}` : ''}
                </h2>
                {selectedId || form.workOrderNo ? (
                  <ZBadge tone="success">Active</ZBadge>
                ) : (
                  <ZBadge tone="idle">Idle</ZBadge>
                )}
              </div>
              <div className="meta-grid">
                <MetaItem label="Customer">{displayVal(form.customerName || form.customerCode)}</MetaItem>
                <MetaItem label="Grade" mono>
                  {displayVal(form.gradeCode)}
                </MetaItem>
                <MetaItem label="Work Order" mono>
                  {displayVal(form.workOrderNo)}
                </MetaItem>
                <MetaItem label="Final Size (OD / ID / TH / LEN)" mono>
                  {formatFinalSize(form)}
                </MetaItem>
                <MetaItem label="Draw Plan Len" mono>
                  {form.drawPlanLenMm !== '' ? `${form.drawPlanLenMm} mm` : '—'}
                </MetaItem>
                <MetaItem label="Bench" mono>
                  {displayVal(form.benchCode)}
                </MetaItem>
                <MetaItem label="Batch" mono>
                  {displayVal(batchLabel)}
                </MetaItem>
                <MetaItem label="Date" mono>
                  {displayVal(form.prodDate)}
                </MetaItem>
                <MetaItem label="Shift" mono>
                  {displayVal(form.shiftRef)}
                </MetaItem>
              </div>
            </section>

            <section className="panel db-console__prod-card">
              <div className="db-console__prod-card-head">
                <h2>Production</h2>
                <div className="db-console__spec-strip">
                  <div>
                    <span className="db-console__spec-label">Final OD / TH</span>
                    <strong className="font-mono">
                      {form.finalOd || '—'} / {form.finalThk || '—'} mm
                    </strong>
                  </div>
                  <div>
                    <span className="db-console__spec-label">Draw plan length</span>
                    <strong className="font-mono">
                      {form.drawPlanLenMm !== '' ? `${form.drawPlanLenMm} mm` : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="db-console__group">
                <h3 className="db-console__group-title">FROM (incoming)</h3>
                <div className="form-grid db-console__dim-grid">
                  <label>
                    <FieldLabel>OD (mm)</FieldLabel>
                    <ZInput
                      value={form.fromOd}
                      onChange={(e) => setField('fromOd', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>TH (mm)</FieldLabel>
                    <ZInput
                      value={form.fromThk}
                      onChange={(e) => setField('fromThk', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>LEN (mm)</FieldLabel>
                    <ZInput
                      value={form.fromLen}
                      onChange={(e) => setField('fromLen', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                </div>
              </div>

              <div className="db-console__group">
                <h3 className="db-console__group-title">TO (drawn)</h3>
                <div className="form-grid db-console__dim-grid">
                  <label>
                    <FieldLabel>OD (mm)</FieldLabel>
                    <ZInput
                      value={form.toOd}
                      onChange={(e) => setField('toOd', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>ID (mm)</FieldLabel>
                    <ZInput
                      value={form.toId}
                      onChange={(e) => setField('toId', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>TH (mm)</FieldLabel>
                    <ZInput
                      value={form.toThk}
                      onChange={(e) => setField('toThk', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>LEN (mm)</FieldLabel>
                    <ZInput
                      value={form.toLen}
                      onChange={(e) => setField('toLen', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                </div>
              </div>

              <div className="db-console__group">
                <h3 className="db-console__group-title">Qty / stage</h3>
                <div className="form-grid">
                  <label>
                    <FieldLabel>Inter / Final</FieldLabel>
                    <ZSelect
                      value={form.stage}
                      onChange={(e) => setField('stage', e.target.value)}
                      disabled={locked}
                    >
                      <option value="INTER">INTER</option>
                      <option value="FINAL">FINAL</option>
                    </ZSelect>
                  </label>
                  <label>
                    <FieldLabel>Accepted Nos</FieldLabel>
                    <ZInput
                      value={form.acceptedPcs}
                      onChange={(e) => setField('acceptedPcs', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>Accepted MT</FieldLabel>
                    <ZInput
                      value={form.acceptedMt}
                      onChange={(e) => setField('acceptedMt', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>Rejected Nos</FieldLabel>
                    <ZInput
                      value={form.rejectedPcs}
                      onChange={(e) => setField('rejectedPcs', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label>
                    <FieldLabel>Drawn Meter</FieldLabel>
                    <ZInput
                      value={form.drawnMetre}
                      onChange={(e) => setField('drawnMetre', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                </div>
              </div>

              <div className="db-console__group">
                <h3 className="db-console__group-title">Remarks</h3>
                <div className="form-grid">
                  <label className="span-2">
                    <FieldLabel>Remarks</FieldLabel>
                    <ZInput
                      value={form.remarks}
                      onChange={(e) => setField('remarks', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                  <label className="span-2">
                    <FieldLabel>Break Down / Remarks</FieldLabel>
                    <ZInput
                      value={form.breakdownRemark}
                      onChange={(e) => setField('breakdownRemark', e.target.value)}
                      disabled={locked}
                    />
                  </label>
                </div>
              </div>
            </section>

            <div className="db-console__save-bar">
              <ZButton
                variant="primary"
                className="db-console__save-primary"
                disabled={!isWritable || locked}
                onClick={() => void saveDraft()}
              >
                Save Production Data
              </ZButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
