import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { ZButton } from '../../ui';
import { PROCESS_META, processPath } from '../../lib/roleHome';
import { BandControlChart, BarSeries, TrendLine } from '../../components/charts';

const PROCESS_LIVE = [
  { id: 'tm', code: 'TM' },
  { id: 'fur', code: 'FUR' },
  { id: 'stp', code: 'STP' },
  { id: 'drw', code: 'DRW' },
  { id: 'swg', code: 'SWG' },
];

const WINDOWS = [7, 14, 30];

const QUALITY_META = {
  TM: { title: 'Line speed control', unit: 'm/min' },
  FUR: { title: 'Furnace line speed', unit: 'm/hr' },
  STP: { title: 'Bath HCl %', unit: '%' },
  DRW: { title: 'OD (mm)', unit: 'mm' },
  SWG: { title: 'Quality', unit: '' },
};

export default function MhProcessLivePage({
  processId,
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const entry = PROCESS_LIVE.find((p) => p.id === processId) ?? PROCESS_LIVE[0];
  const meta = PROCESS_META.find((p) => p.id === entry.code) ?? PROCESS_META[0];
  const floor = processPath(meta.id);
  const [windowDays, setWindowDays] = useState(14);
  const [stats, setStats] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [trend, setTrend] = useState(null);
  const [quality, setQuality] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dash, pending, tr, q] = await Promise.all([
          apiRequest('/reports/machine-head'),
          apiRequest('/reports/machine-head/pending').catch(() => null),
          apiRequest(
            `/reports/machine-head/trend?process=${encodeURIComponent(meta.id)}&windowDays=${windowDays}`
          ).catch(() => null),
          apiRequest(
            `/reports/machine-head/quality?process=${encodeURIComponent(meta.id)}&windowDays=${windowDays}`
          ).catch(() => null),
        ]);
        if (cancelled) return;
        setStats(dash?.byProcess?.[meta.id] ?? { open: 0, running: 0, submitted: 0, hold: 0 });
        const items = pending?.items ?? pending ?? [];
        const list = Array.isArray(items) ? items : [];
        setPendingCount(list.filter((it) => it.process === meta.id).length);
        setTrend(tr);
        setQuality(q);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.id, windowDays]);

  const s = stats ?? { open: 0, running: 0, submitted: 0, hold: 0 };
  const qMeta = QUALITY_META[meta.id] ?? QUALITY_META.FUR;

  const controlSeries = useMemo(() => {
    const rows = quality?.series ?? [];
    return rows.map((r) => ({
      ...r,
      at: r.at ? String(r.at).slice(0, 16).replace('T', ' ') : r.at,
    }));
  }, [quality]);

  const bandMin =
    controlSeries.find((r) => r.bandMin != null)?.bandMin ??
    (controlSeries[0]?.bandMin != null ? controlSeries[0].bandMin : undefined);
  const bandMax =
    controlSeries.find((r) => r.bandMax != null)?.bandMax ??
    (controlSeries[0]?.bandMax != null ? controlSeries[0].bandMax : undefined);
  const target = controlSeries.find((r) => r.target != null)?.target;

  const zoneSeries = useMemo(() => {
    if (meta.id !== 'FUR') return [];
    return (quality?.zones ?? []).map((z) => ({
      ...z,
      at: z.at ? String(z.at).slice(0, 16).replace('T', ' ') : z.at,
    }));
  }, [quality, meta.id]);

  return (
    <MachineHeadShell
      title={`${meta.label} desk`}
      subtitle="Machine-scoped counts and control charts — open the floor for production capture"
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
      actions={
        <Link to={floor}>
          <ZButton variant="primary">Open floor</ZButton>
        </Link>
      }
    >
      <div className="mh-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="mh-window-pills" role="group" aria-label="Window days">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              className={windowDays === d ? 'is-active' : ''}
              onClick={() => setWindowDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="mh-kpi-strip">
          <div className="mh-kpi">
            <span className="mh-kpi__label">Open</span>
            <strong>{s.open ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Running</span>
            <strong>{s.running ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Submitted</span>
            <strong>{s.submitted ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Hold</span>
            <strong>{s.hold ?? 0}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Pending review</span>
            <strong>{pendingCount ?? s.submitted ?? 0}</strong>
          </div>
        </div>

        <div className="mh-graph-grid">
          <BarSeries
            title="Output (MT)"
            subtitle={`${windowDays}-day window`}
            data={(trend?.series ?? []).map((r) => ({
              name: String(r.date).slice(5),
              value: r.mt,
            }))}
            xKey="name"
            series={[{ key: 'value', label: 'MT' }]}
            layout="horizontal"
            legend={false}
            error={error}
          />
          <TrendLine
            title="Yield %"
            data={trend?.series ?? []}
            xKey="date"
            yKey="yieldPct"
            yLabel="Yield %"
            target={meta.id === 'TM' ? 90 : undefined}
            error={error}
          />
          <BandControlChart
            className="chart-frame--wide"
            title={qMeta.title}
            subtitle={
              quality?.unit
                ? `Spec band · ${quality.unit}${quality.machineScope != null && Array.isArray(quality.machineScope) && quality.machineScope.length ? ` · ${quality.machineScope.join(', ')}` : ''}`
                : 'Spec band'
            }
            data={controlSeries}
            xKey="at"
            seriesKeys={['value']}
            seriesLabels={{ value: qMeta.title }}
            bandMin={bandMin}
            bandMax={bandMax}
            target={target}
            error={error}
          />
          {meta.id === 'FUR' ? (
            <BandControlChart
              className="chart-frame--wide"
              title="Zone temperatures (set midpoint)"
              subtitle="Out-of-band markers when midpoint leaves recipe min/max"
              data={zoneSeries}
              xKey="at"
              seriesKeys={['zone1', 'zone2', 'zone3', 'zone4', 'zone5', 'zone6']}
              seriesLabels={{
                zone1: 'Z1',
                zone2: 'Z2',
                zone3: 'Z3',
                zone4: 'Z4',
                zone5: 'Z5',
                zone6: 'Z6',
              }}
              error={error}
            />
          ) : null}
        </div>

        <section className="mh-panel">
          <h2 className="mh-panel__title">
            {meta.label} · {meta.machineCode}
          </h2>
          <p className="mh-panel__hint">
            Use Review for submitted approvals and Exports for FT reports. Capture and live boards stay on
            the operator floor.
          </p>
          <div className="mh-link-row">
            <Link to="/machine-head/shift-review">Shift review</Link>
            <Link to="/machine-head-dashboard">All processes</Link>
            <Link to={floor}>Floor capture</Link>
            <Link to="/machine-head/dpr-export">Exports</Link>
          </div>
        </section>
      </div>
    </MachineHeadShell>
  );
}
