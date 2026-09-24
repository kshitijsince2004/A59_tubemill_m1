import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlantShell } from '../../components/layout/planthead';
import { plantReportsApi } from '../../api/plantReportsApi';
import {
  TrendLine,
  BarSeries,
  ParetoBar,
  RadialGauge,
} from '../../components/charts';

const WINDOWS = [7, 14, 30];

export default function PlantHeadDashboard({ roleLabel, showAdmin, onLogout, firstFloorPath }) {
  const [windowDays, setWindowDays] = useState(7);
  const [dash, setDash] = useState(null);
  const [trend, setTrend] = useState(null);
  const [stages, setStages] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, tr, st] = await Promise.all([
          plantReportsApi.dashboard(windowDays),
          plantReportsApi.trend(windowDays),
          plantReportsApi.stages(windowDays),
        ]);
        if (!cancelled) {
          setDash(data);
          setTrend(tr);
          setStages(st);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load plant dashboard');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  const kpi = dash?.kpi ?? {};
  const alertCount = dash?.alerts?.length ?? 0;
  const series = trend?.series ?? [];
  const stageRows = (stages?.stages ?? []).map((s) => ({
    name: s.process,
    label: s.label || s.process,
    outputMt: s.outputMt != null ? s.outputMt : 0,
    count: s.count ?? 0,
    hasMt: s.outputMt != null,
  }));
  const oeeFactors = [
    { name: 'A', value: kpi.availability ?? 0 },
    { name: 'P', value: kpi.performance ?? 0 },
    { name: 'Q', value: kpi.quality ?? 0 },
  ];
  const statusBars = ['TM', 'FUR', 'STP', 'DRW', 'SWG'].map((id) => {
    const s = dash?.byProcess?.[id] ?? {};
    return {
      name: id,
      open: s.open ?? 0,
      running: s.running ?? 0,
      submitted: s.submitted ?? 0,
      hold: s.hold ?? 0,
    };
  });

  return (
    <PlantShell
      title="Overview"
      subtitle={`Plant-wide KPIs · Tube Mill → Furnace → STP → Draw Bench (${windowDays}-day window)`}
      roleLabel={roleLabel}
      showAdmin={showAdmin}
      onLogout={onLogout}
      firstFloorPath={firstFloorPath}
    >
      <div className="ph-console">
        {error ? <div className="error-strip">{error}</div> : null}

        <div className="ph-window-pills" role="group" aria-label="Window days">
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

        <div className="ph-kpi-strip">
          <div className="ph-kpi">
            <span className="ph-kpi__label">Prime MT ({windowDays}d)</span>
            <strong>{kpi.todayMt ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Yield %</span>
            <strong>{kpi.yieldPct ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">OEE (est.)</span>
            <strong>{kpi.oee ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Downtime min</span>
            <strong>{kpi.downtimeMin ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Backlog orders</span>
            <strong>{kpi.backlogOrders ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Holds</span>
            <strong>{kpi.machinesHold ?? '—'}</strong>
          </div>
          <div className="ph-kpi">
            <span className="ph-kpi__label">Alerts</span>
            <strong>{alertCount}</strong>
          </div>
        </div>

        <div className="ph-graph-grid">
          <TrendLine
            className="chart-frame--wide"
            title="Prime MT trend"
            subtitle="Daily prime output (MT)"
            data={series}
            xKey="date"
            yKey="primeMt"
            yLabel="Prime MT"
            area
            error={error}
          />
          <TrendLine
            title="Yield %"
            subtitle="Target 90%"
            data={series}
            xKey="date"
            yKey="yieldPct"
            yLabel="Yield %"
            target={90}
            targetLabel="90%"
            error={error}
          />
          <RadialGauge
            title="OEE (est.)"
            subtitle="Estimated · performance fixed at 85"
            value={kpi.oee}
            error={error}
          />
          <BarSeries
            title="OEE factors (est.)"
            subtitle="Availability · Performance · Quality"
            data={oeeFactors}
            xKey="name"
            series={[{ key: 'value', label: '%' }]}
            layout="horizontal"
            legend={false}
            error={error}
          />
          <BarSeries
            className="chart-frame--wide"
            title="Stage throughput"
            subtitle="Output MT where available; count when MT is null"
            data={stageRows.map((s) => ({
              name: s.name,
              mt: s.hasMt ? s.outputMt : 0,
              count: s.count,
            }))}
            xKey="name"
            series={[
              { key: 'mt', label: 'Output MT' },
              { key: 'count', label: 'Lots / runs' },
            ]}
            layout="vertical"
            error={error}
          />
          <ParetoBar
            title="Downtime Pareto"
            subtitle="Top stoppage minutes"
            data={(dash?.topStoppages ?? []).map((d) => ({
              label: d.label || d.code,
              value: d.minutes,
              code: d.code,
            }))}
            nameKey="label"
            valueKey="value"
            error={error}
          />
          <ParetoBar
            title="Defect Pareto"
            subtitle="Tube Mill defects"
            data={(dash?.topDefects ?? []).map((d) => ({
              label: d.label || d.code,
              value: d.count,
              code: d.code,
            }))}
            nameKey="label"
            valueKey="value"
            error={error}
          />
          <BarSeries
            className="chart-frame--wide"
            title="Machine status by process"
            subtitle="Live counts"
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
        </div>

        <div className="ph-link-row">
          <Link to="/plant/live">Live board</Link>
          <Link to="/plant/production">Production</Link>
          <Link to="/plant/orders">Orders</Link>
          <Link to="/plant/alerts">Alerts ({alertCount})</Link>
          <Link to="/plant/dpr-export">Exports</Link>
        </div>
      </div>
    </PlantShell>
  );
}
