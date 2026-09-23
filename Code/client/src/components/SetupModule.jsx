import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZBadge, ZSelect } from '../ui';
import FormModal from './FormModal';
import ToolingPanel from './ToolingPanel';
import { tubemillApi } from '../api/tubemillClient';

const DEFAULT_MILL = 'A-59';

const SIZE_OPTIONS = [
  { sizeKey: 'OD25.4', thkMm: 2.6, gradeCode: '1010' },
  { sizeKey: 'OD25.4', thkMm: 3.0, gradeCode: '1010' },
  { sizeKey: 'SEC40X25(41.28)', thkMm: 1.5, gradeCode: '1010' },
];

/**
 * Independent Setup module (TM-05).
 * Machine-scoped sheets — no production run / work order FK.
 */
export default function SetupModule({ millCode = DEFAULT_MILL, disabled }) {
  const qc = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [sizeKey, setSizeKey] = useState(SIZE_OPTIONS[0].sizeKey);
  const [thkMm, setThkMm] = useState(String(SIZE_OPTIONS[0].thkMm));
  const [gradeCode, setGradeCode] = useState(SIZE_OPTIONS[0].gradeCode);
  const [prefill, setPrefill] = useState(null);
  const [prefillError, setPrefillError] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: setups = [], isLoading } = useQuery({
    queryKey: ['mill-setups', millCode],
    queryFn: () => tubemillApi.listMillSetups(millCode),
    refetchInterval: 15_000,
  });

  const { data: detail } = useQuery({
    queryKey: ['mill-setup', selectedId],
    queryFn: () => tubemillApi.getMillSetup(selectedId),
    enabled: Boolean(selectedId) && detailOpen,
  });

  const chartKey = useMemo(
    () => `${sizeKey}|${thkMm}|${gradeCode}`,
    [sizeKey, thkMm, gradeCode]
  );

  async function loadChart() {
    setPrefillError('');
    setBusy(true);
    try {
      const data = await tubemillApi.chartPrefill(sizeKey, thkMm, gradeCode);
      setPrefill(data);
      setFormOpen(true);
    } catch (e) {
      setPrefill(null);
      setPrefillError(e instanceof Error ? e.message : 'Chart prefill failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-gap">
      <section className="panel">
        <header className="panel__header">
          <span className="eyebrow">GLI-FT-PRD-TM-05 Mill Setup Parameter Sheet</span>
          <ZBadge tone="idle">{millCode}</ZBadge>
        </header>
        <p className="muted" style={{ marginTop: 0 }}>
          Independent of Orders and Production Runs. Choose size / grade to prefill tooling from the TM-02 chart.
        </p>
        <div className="form-row">
          <div>
            <label>Size / thk / grade</label>
            <ZSelect
              value={`${sizeKey}|${thkMm}|${gradeCode}`}
              onChange={(e) => {
                const opt =
                  SIZE_OPTIONS.find(
                    (o) => `${o.sizeKey}|${o.thkMm}|${o.gradeCode}` === e.target.value
                  ) ?? SIZE_OPTIONS[0];
                setSizeKey(opt.sizeKey);
                setThkMm(String(opt.thkMm));
                setGradeCode(opt.gradeCode);
              }}
              disabled={disabled}
            >
              {SIZE_OPTIONS.map((o) => (
                <option
                  key={`${o.sizeKey}|${o.thkMm}|${o.gradeCode}`}
                  value={`${o.sizeKey}|${o.thkMm}|${o.gradeCode}`}
                >
                  {o.sizeKey} · {o.thkMm} mm · {o.gradeCode}
                </option>
              ))}
            </ZSelect>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: '0.75rem' }}>
          <ZButton variant="primary" disabled={disabled || busy} onClick={() => void loadChart()}>
            New setup from chart
          </ZButton>
        </div>
        {prefillError ? <p className="error-text">{prefillError}</p> : null}
      </section>

      <section className="panel">
        <header className="panel__header">
          <span className="eyebrow">Saved setup sheets</span>
          <ZBadge tone="idle">{String(setups.length)}</ZBadge>
        </header>
        {isLoading ? <p className="empty-hint">Loading…</p> : null}
        <ul className="panel__list">
          {setups.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="linkish font-mono"
                onClick={() => {
                  setSelectedId(s.id);
                  setDetailOpen(true);
                }}
              >
                {(s.sizeKey ?? '—') +
                  ' / ' +
                  (s.gradeCode ?? '—') +
                  ' · ' +
                  (s.idTool ?? '—') +
                  ' / ' +
                  (s.odTool ?? '—') +
                  ' · ' +
                  (s.createdAt ? new Date(s.createdAt).toLocaleString() : '')}
              </button>
            </li>
          ))}
          {!setups.length && !isLoading ? (
            <li className="empty-hint">No independent setup sheets yet.</li>
          ) : null}
        </ul>
      </section>

      <FormModal
        open={formOpen && Boolean(prefill)}
        eyebrow={`New setup · TM-05 · ${millCode}`}
        title="Confirm mill setup"
        description={`Prefill from TM-02 chart · ${chartKey}. Independent of work order / run.`}
        onClose={() => {
          setFormOpen(false);
          setPrefill(null);
        }}
        footer={null}
      >
        {prefill ? (
          <ToolingPanel
            tooling={prefill.tooling}
            band={prefill.band}
            disabled={disabled || busy}
            onConfirm={async (data) => {
              setBusy(true);
              try {
                await tubemillApi.createMillSetup({
                  millCode,
                  sizeKey: prefill.sizeKey,
                  gradeCode: prefill.gradeCode,
                  thkMm: prefill.thkMm,
                  ...data,
                });
                void qc.invalidateQueries({ queryKey: ['mill-setups', millCode] });
                setPrefill(null);
                setFormOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </FormModal>

      <FormModal
        open={detailOpen && Boolean(detail)}
        eyebrow="Setup sheet · TM-05"
        title="Setup detail"
        description={
          detail
            ? `${detail.sizeKey ?? '—'} / ${detail.gradeCode ?? '—'} · thk ${detail.thkMm ?? '—'} · ${
                detail.createdAt ? new Date(detail.createdAt).toLocaleString() : ''
              }`
            : undefined
        }
        onClose={() => {
          setDetailOpen(false);
          setSelectedId(null);
        }}
        footer={
          <ZButton
            variant="ghost"
            onClick={() => {
              setDetailOpen(false);
              setSelectedId(null);
            }}
          >
            Close
          </ZButton>
        }
      >
        {detail ? (
          <div className="meta-grid">
            <div className="meta-grid__item">
              <label>ID Tool</label>
              <div className="value font-mono">{detail.idTool ?? '—'}</div>
            </div>
            <div className="meta-grid__item">
              <label>OD Tool</label>
              <div className="value font-mono">{detail.odTool ?? '—'}</div>
            </div>
            <div className="meta-grid__item">
              <label>Work coil</label>
              <div className="value font-mono">{detail.workCoilId ?? '—'}</div>
            </div>
            <div className="meta-grid__item">
              <label>Impeder</label>
              <div className="value font-mono">{detail.impederSize ?? '—'}</div>
            </div>
            <div className="meta-grid__item">
              <label>Coolant %</label>
              <div className="value font-mono">{detail.coolantConcPct ?? '—'}</div>
            </div>
            <div className="meta-grid__item">
              <label>First-off</label>
              <div className="value font-mono">{detail.firstOffResult ?? '—'}</div>
            </div>
          </div>
        ) : (
          <p className="empty-hint">Loading…</p>
        )}
      </FormModal>
    </div>
  );
}
