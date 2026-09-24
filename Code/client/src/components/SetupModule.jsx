import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ZButton, ZBadge, ZInput, ZSelect } from '../ui';
import FormModal from './FormModal';
import ToolingPanel from './ToolingPanel';
import { tubemillApi } from '../api/tubemillClient';

const DEFAULT_MILL = 'A-59';

function setupLabel(s) {
  return (
    s.note ||
    [s.sizeKey, s.gradeCode, s.thkMm != null ? `${s.thkMm}mm` : null].filter(Boolean).join(' · ') ||
    'Unnamed setup'
  );
}

function toolingLine(s) {
  return [s.idTool, s.odTool, s.workCoilId].filter(Boolean).join(' / ') || '—';
}

/**
 * Independent Setup module (TM-05) — select existing or create new reusable sheets.
 */
export default function SetupModule({ millCode = DEFAULT_MILL, disabled }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState('new'); // new | duplicate
  const [sizeKey, setSizeKey] = useState('');
  const [thkMm, setThkMm] = useState('');
  const [gradeCode, setGradeCode] = useState('');
  const [prefill, setPrefill] = useState(null);
  const [initialManual, setInitialManual] = useState(null);
  const [defaultNote, setDefaultNote] = useState('');
  const [prefillError, setPrefillError] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: setups = [], isLoading } = useQuery({
    queryKey: ['mill-setups', millCode],
    queryFn: () => tubemillApi.listMillSetups(millCode),
    refetchInterval: 15_000,
  });

  const { data: chartRows = [] } = useQuery({
    queryKey: ['param-chart'],
    queryFn: () => tubemillApi.getParamChart(),
  });

  const sizeOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const row of chartRows) {
      const sk = row.sizeKey ?? row.size_key;
      const thk = row.thkMm ?? row.thk_mm;
      const grade = row.gradeCode ?? row.grade_code;
      if (!sk || thk == null || !grade) continue;
      const key = `${sk}|${thk}|${grade}`;
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push({ sizeKey: sk, thkMm: Number(thk), gradeCode: String(grade) });
    }
    return opts.length
      ? opts
      : [
          { sizeKey: 'OD25.4', thkMm: 2.6, gradeCode: '1010' },
          { sizeKey: 'OD25.4', thkMm: 3.0, gradeCode: '1010' },
          { sizeKey: 'SEC40X25(41.28)', thkMm: 1.5, gradeCode: '1010' },
        ];
  }, [chartRows]);

  const filteredSetups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return setups;
    return setups.filter((s) => {
      const hay = [s.note, s.sizeKey, s.gradeCode, s.idTool, s.odTool, s.workCoilId, s.thkMm]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [setups, search]);

  const chartKey = useMemo(
    () => (sizeKey && thkMm && gradeCode ? `${sizeKey}|${thkMm}|${gradeCode}` : ''),
    [sizeKey, thkMm, gradeCode]
  );

  function ensureSizeDefaults() {
    if (sizeKey && thkMm && gradeCode) return;
    const first = sizeOptions[0];
    if (!first) return;
    setSizeKey(first.sizeKey);
    setThkMm(String(first.thkMm));
    setGradeCode(first.gradeCode);
  }

  async function startNewFromChart() {
    ensureSizeDefaults();
    const sk = sizeKey || sizeOptions[0]?.sizeKey;
    const thk = thkMm || String(sizeOptions[0]?.thkMm ?? '');
    const grade = gradeCode || sizeOptions[0]?.gradeCode;
    if (!sk || !thk || !grade) {
      setPrefillError('Select size / thickness / grade');
      return;
    }
    setPrefillError('');
    setBusy(true);
    try {
      const data = await tubemillApi.chartPrefill(sk, thk, grade);
      setPrefill(data);
      setInitialManual(null);
      setDefaultNote(`${sk}-${grade}-${thk}`);
      setMode('new');
      setFormOpen(true);
    } catch (e) {
      setPrefill(null);
      setPrefillError(e instanceof Error ? e.message : 'Chart prefill failed');
    } finally {
      setBusy(false);
    }
  }

  async function useExisting(id) {
    const setupId = id || selectedId;
    if (!setupId) {
      setPrefillError('Select a saved setup first');
      return;
    }
    setPrefillError('');
    setBusy(true);
    try {
      const detail = await tubemillApi.getMillSetup(setupId);
      const sk = detail.sizeKey;
      const thk = detail.thkMm;
      const grade = detail.gradeCode;
      let chart = null;
      if (sk && thk != null && grade) {
        try {
          chart = await tubemillApi.chartPrefill(sk, thk, grade);
        } catch {
          chart = null;
        }
      }
      setPrefill({
        sizeKey: sk,
        thkMm: thk,
        gradeCode: grade,
        tooling: detail.tooling ?? {
          idTool: detail.idTool,
          odTool: detail.odTool,
          boggieSize: detail.boggieSize,
          impederSize: detail.impederSize,
          ferriteRod: detail.ferriteRod,
          ssRod: detail.ssRod,
          workCoilId: detail.workCoilId,
          seamGuide: detail.seamGuide,
          weldDiaMm: detail.weldDiaMm,
        },
        band: chart?.band ?? null,
      });
      setInitialManual(detail);
      const baseName = setupLabel(detail);
      setDefaultNote(baseName.endsWith(' copy') ? baseName : `${baseName} copy`);
      setMode('duplicate');
      setFormOpen(true);
    } catch (e) {
      setPrefillError(e instanceof Error ? e.message : 'Failed to load setup');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-gap tm-setup-picker">
      <section className="panel">
        <header className="panel__header">
          <span className="eyebrow">GLI-FT-PRD-TM-05 Mill Setup</span>
          <ZBadge tone="idle">{millCode}</ZBadge>
        </header>
        <p className="muted" style={{ marginTop: 0 }}>
          Reusable machine setups — independent of work orders. Select an existing sheet or create a new
          one from the TM-02 chart.
        </p>

        <div className="tm-setup-picker__actions">
          <div className="form-row">
            <div style={{ flex: 2 }}>
              <label>Select existing setup</label>
              <ZSelect
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={disabled || !setups.length}
              >
                <option value="">— Choose saved setup —</option>
                {setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {setupLabel(s)} · {toolingLine(s)}
                  </option>
                ))}
              </ZSelect>
            </div>
            <div style={{ alignSelf: 'end' }}>
              <ZButton
                variant="primary"
                disabled={disabled || busy || !selectedId}
                onClick={() => void useExisting()}
              >
                Use selected
              </ZButton>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <div>
              <label>New from chart · size / thk / grade</label>
              <ZSelect
                value={
                  sizeKey && thkMm && gradeCode ? `${sizeKey}|${thkMm}|${gradeCode}` : ''
                }
                onChange={(e) => {
                  const opt =
                    sizeOptions.find(
                      (o) => `${o.sizeKey}|${o.thkMm}|${o.gradeCode}` === e.target.value
                    ) ?? sizeOptions[0];
                  if (!opt) return;
                  setSizeKey(opt.sizeKey);
                  setThkMm(String(opt.thkMm));
                  setGradeCode(opt.gradeCode);
                }}
                disabled={disabled}
              >
                <option value="">— Select —</option>
                {sizeOptions.map((o) => (
                  <option
                    key={`${o.sizeKey}|${o.thkMm}|${o.gradeCode}`}
                    value={`${o.sizeKey}|${o.thkMm}|${o.gradeCode}`}
                  >
                    {o.sizeKey} · {o.thkMm} mm · {o.gradeCode}
                  </option>
                ))}
              </ZSelect>
            </div>
            <div style={{ alignSelf: 'end' }}>
              <ZButton
                variant="accent"
                disabled={disabled || busy}
                onClick={() => void startNewFromChart()}
              >
                New setup
              </ZButton>
            </div>
          </div>
          {prefillError ? <p className="error-text">{prefillError}</p> : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header">
          <span className="eyebrow">Saved setups</span>
          <ZBadge tone="idle">{String(filteredSetups.length)}</ZBadge>
        </header>
        <ZInput
          placeholder="Filter by name, size, grade, tool…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: '0.75rem', minHeight: 48 }}
        />
        {isLoading ? <p className="empty-hint">Loading…</p> : null}
        <div className="tm-setup-picker__list">
          {filteredSetups.map((s) => (
            <article key={s.id} className="tm-setup-card">
              <div>
                <div className="tm-setup-card__name font-mono">{setupLabel(s)}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {(s.sizeKey ?? '—') +
                    ' / ' +
                    (s.gradeCode ?? '—') +
                    (s.thkMm != null ? ` · ${s.thkMm} mm` : '')}
                </div>
                <div className="font-mono" style={{ fontSize: '0.85rem' }}>
                  {toolingLine(s)}
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                </div>
              </div>
              <ZButton
                variant="ghost"
                size="sm"
                disabled={disabled || busy}
                onClick={() => {
                  setSelectedId(s.id);
                  void useExisting(s.id);
                }}
              >
                Use
              </ZButton>
            </article>
          ))}
          {!filteredSetups.length && !isLoading ? (
            <p className="empty-hint">No setups yet — create one from the chart.</p>
          ) : null}
        </div>
      </section>

      <FormModal
        open={formOpen && Boolean(prefill)}
        eyebrow={`${mode === 'duplicate' ? 'Reuse setup' : 'New setup'} · TM-05 · ${millCode}`}
        title="Confirm mill setup"
        description={
          chartKey
            ? `${mode === 'duplicate' ? 'Copied from prior sheet' : 'Prefill from TM-02'} · ${chartKey}`
            : undefined
        }
        preventScrimClose
        onClose={() => {
          setFormOpen(false);
          setPrefill(null);
          setInitialManual(null);
        }}
        footer={null}
        className="modal-card--wide-tablet"
      >
        {prefill ? (
          <ToolingPanel
            tooling={prefill.tooling}
            band={prefill.band}
            initial={initialManual}
            defaultNote={defaultNote}
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
                setInitialManual(null);
                setFormOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </FormModal>
    </div>
  );
}
