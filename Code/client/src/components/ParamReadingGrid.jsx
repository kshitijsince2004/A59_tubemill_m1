import { useQuery } from '@tanstack/react-query';
import { tubemillApi } from '../api/tubemillClient';

function fmt(v) {
  if (v == null || v === '') return '—';
  return String(v);
}

function fmtHour(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

/**
 * Hourly AUTO + MANUAL readings for a mill (independent of production run).
 */
export default function ParamReadingGrid({ millCode = 'A-59' }) {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['mill-param-readings', millCode],
    queryFn: () => tubemillApi.listMillParams(millCode),
    enabled: Boolean(millCode),
    refetchInterval: 15_000,
  });

  return (
    <div className="panel">
      <h2>Hourly parameter log</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Independent mill readings. Speed / power / WC–WR are manual until PLC; order/setup context is not
        stored on the record.
      </p>
      {isLoading && <p className="empty-hint">Loading readings…</p>}
      {error && (
        <p className="error-text">{error instanceof Error ? error.message : 'Failed to load'}</p>
      )}
      {!isLoading && !rows.length && <p className="empty-hint">No hourly readings yet</p>}
      {rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hour</th>
                <th>Speed mpm</th>
                <th>Power kW</th>
                <th>WC–WR mm</th>
                <th>Coolant %</th>
                <th>Pressure kg</th>
                <th>Wiper</th>
                <th>Argon</th>
                <th>Source</th>
                <th>Sign</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id ?? r.ts_hour}>
                  <td className="font-mono">{fmtHour(r.ts_hour)}</td>
                  <td className="font-mono">{fmt(r.line_speed_mpm)}</td>
                  <td className="font-mono">{fmt(r.weld_power_kw)}</td>
                  <td className="font-mono">{fmt(r.wc_to_wr_distance_mm)}</td>
                  <td className="font-mono">{fmt(r.coolant_oil_pct)}</td>
                  <td className="font-mono">{fmt(r.coolant_pressure_kg)}</td>
                  <td>{r.wiper_change == null ? '—' : r.wiper_change ? 'Y' : 'N'}</td>
                  <td>{r.argon_used == null ? '—' : r.argon_used ? 'Y' : 'N'}</td>
                  <td>{fmt(r.source)}</td>
                  <td>{fmt(r.sign_ref)}</td>
                  <td>{fmt(r.remarks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
