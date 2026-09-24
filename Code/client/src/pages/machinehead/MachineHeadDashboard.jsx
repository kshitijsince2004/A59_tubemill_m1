import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MachineHeadShell } from '../../components/layout/machinehead';
import { apiRequest } from '../../api/http';
import { PROCESS_META, allowedProcesses } from '../../lib/roleHome';
import { BarSeries, TrendLine } from '../../components/charts';

const DESK_PATH = {
  TM: '/machine-head/tm/live',
  FUR: '/machine-head/fur/live',
  STP: '/machine-head/stp/live',
  DRW: '/machine-head/drw/live',
  SWG: '/machine-head/swg/live',
};

const WINDOWS = [7, 14, 30];

export default function MachineHeadDashboard({
  user,
  roleLabel,
  showAdmin,
  showPlant,
  onLogout,
  firstFloorPath,
}) {
  const [windowDays, setWindowDays] = useState(7);
  const [processFilter, setProcessFilter] = useState('TM');
  const [dash, setDash] = useState(null);
  const [pending, setPending] = useState(null);
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState(null);

  const processes = useMemo(() => {
    if (!user) return PROCESS_META;
    const allowed = allowedProcesses(user);
    return allowed.length ? allowed : PROCESS_META;
  }, [user]);

  useEffect(() => {
    if (!processes.some((p) => p.id === processFilter) && processes[0]) {
      setProcessFilter(processes[0].id);
    }
  }, [processes, processFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, pend, tr] = await Promise.all([
          apiRequest('/reports/machine-head'),
          apiRequest('/reports/machine-head/pending').catch(() => null),
          apiRequest(
            `/reports/machine-head/trend?process=${encodeURIComponent(processFilter)}&windowDays=${windowDays}`
          ).catch(() => null),
        ]);
        if (!cancelled) {
          setDash(data);
          setPending(pend);
          setTrend(tr);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load desk');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowDays, processFilter]);

  const byProcess = dash?.byProcess ?? {};
  const scope = dash?.machineScope;
  const pendingItems = pending?.items ?? [];
  const pendingCount = Array.isArray(pendingItems) ? pendingItems.length : null;
  const submittedTotal = processes.reduce((n, p) => n + (byProcess[p.id]?.submitted ?? 0), 0);
  const runningTotal = processes.reduce((n, p) => n + (byProcess[p.id]?.running ?? 0), 0);
  const holdTotal = processes.reduce((n, p) => n + (byProcess[p.id]?.hold ?? 0), 0);

  const statusBars = processes.map((p) => {
    const s = byProcess[p.id] ?? {};
    return {
      name: p.id,
      open: s.open ?? 0,
      running: s.running ?? 0,
      submitted: s.submitted ?? 0,
      hold: s.hold ?? 0,
    };
  });

  const aging = pending?.aging ?? {};
  const agingBars = [
    { name: '<1h', value: aging.under1h ?? 0 },
    { name: '1–4h', value: aging['1to4h'] ?? 0 },
    { name: '>4h', value: aging.over4h ?? 0 },
  ];

  const series = trend?.series ?? [];
  const subtitle = [
    'Machine-scoped status across your assigned processes',
    scope != null
      ? Array.isArray(scope)
        ? `Scope: ${scope.length ? scope.join(', ') : 'all accessible'}`
        : `Scope: ${String(scope)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <MachineHeadShell
      title="Desk"
      subtitle={subtitle}
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      showPlant={showPlant}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="mh-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="mh-window-pills" role="group" aria-label="Window and process">
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
          {processes.map((p) => (
            <button
              key={p.id}
              type="button"
              className={processFilter === p.id ? 'is-active' : ''}
              onClick={() => setProcessFilter(p.id)}
            >
              {p.id}
            </button>
          ))}
        </div>

        <div className="mh-kpi-strip">
          <div className="mh-kpi">
            <span className="mh-kpi__label">Processes</span>
            <strong>{processes.length}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Running</span>
            <strong>{runningTotal}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Submitted</span>
            <strong>{submittedTotal}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Hold</span>
            <strong>{holdTotal}</strong>
          </div>
          <div className="mh-kpi">
            <span className="mh-kpi__label">Pending review</span>
            <strong>{pendingCount ?? submittedTotal}</strong>
          </div>
        </div>

        <div className="mh-graph-grid">
          <BarSeries
            className="chart-frame--wide"
            title="Process status"
            subtitle="Open / running / submitted / hold"
            data={statusBars}
            xKey="name"
            series={[
              { key: 'open', label: 'Open', stackId: 's' },
              { key: 'running', label: 'Running', stackId: 's' },
              { key: 'submitted', label: 'Submitted', stackId: 's' },
              { key: 'hold', label: 'Hold', stackId: 's' },
            ]}
            stacked
            layout="horizontal"
            error={error}
          />
          <BarSeries
            title={`${processFilter} output (MT)`}
            subtitle={`${windowDays}-day window`}
            data={series.map((r) => ({ name: r.date.slice(5), value: r.mt }))}
            xKey="name"
            series={[{ key: 'value', label: 'MT' }]}
            layout="horizontal"
            legend={false}
            error={error}
          />
          <TrendLine
            title={`${processFilter} yield %`}
            subtitle={processFilter === 'TM' ? 'From prime / raw' : 'Yield when available'}
            data={series}
            xKey="date"
            yKey="yieldPct"
            yLabel="Yield %"
            target={processFilter === 'TM' ? 90 : undefined}
            error={error}
          />
          <BarSeries
            title="Pending review aging"
            subtitle="Submitted waiting on MH"
            data={agingBars}
            xKey="name"
            series={[{ key: 'value', label: 'Count' }]}
            layout="horizontal"
            legend={false}
            error={error}
          />
        </div>

        <section className="mh-panel">
          <div className="mh-panel__head">
            <h2 className="mh-panel__title">Process desks</h2>
            <Link to="/machine-head/shift-review">Review queue</Link>
          </div>
          <table className="mh-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Line</th>
                <th>Open</th>
                <th>Running</th>
                <th>Submitted</th>
                <th>Hold</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => {
                const s = byProcess[p.id] ?? { open: 0, running: 0, submitted: 0, hold: 0 };
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.label}</strong>
                      <span className="muted"> · {p.id}</span>
                    </td>
                    <td className="mono">{p.machineCode}</td>
                    <td>{s.open ?? 0}</td>
                    <td>{s.running ?? 0}</td>
                    <td>{s.submitted ?? 0}</td>
                    <td>{s.hold ?? 0}</td>
                    <td>
                      <Link to={DESK_PATH[p.id]}>Open desk</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!processes.length ? <p className="mh-empty">No processes in your access.</p> : null}
        </section>

        <div className="mh-link-row">
          <Link to="/machine-head/shift-review">
            Shift review{pendingCount != null ? ` (${pendingCount})` : ''}
          </Link>
          <Link to="/order-assignment">Orders</Link>
          <Link to="/machine-head/dpr-export">Exports</Link>
        </div>
      </div>
    </MachineHeadShell>
  );
}
