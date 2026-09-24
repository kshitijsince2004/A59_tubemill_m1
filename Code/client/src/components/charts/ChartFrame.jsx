import { useState } from 'react';

/**
 * Shared chrome for every dashboard chart: title, empty/error, table toggle.
 */
export default function ChartFrame({
  title,
  subtitle,
  legend,
  error,
  empty,
  emptyMessage = 'No data for this window',
  tableColumns,
  tableRows,
  children,
  className = '',
}) {
  const [showTable, setShowTable] = useState(false);
  const hasTable = Array.isArray(tableColumns) && Array.isArray(tableRows);

  return (
    <section className={`chart-frame ${className}`.trim()}>
      <div className="chart-frame__head">
        <div>
          <h3 className="chart-frame__title">{title}</h3>
          {subtitle ? <p className="chart-frame__subtitle">{subtitle}</p> : null}
        </div>
        <div className="chart-frame__actions">
          {legend}
          {hasTable ? (
            <button
              type="button"
              className="chart-frame__toggle"
              onClick={() => setShowTable((v) => !v)}
            >
              {showTable ? 'Chart' : 'Table'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="error-strip chart-frame__error">{error}</div> : null}

      {!error && empty ? (
        <p className="chart-frame__empty muted">{emptyMessage}</p>
      ) : null}

      {!error && !empty && !showTable ? <div className="chart-frame__body">{children}</div> : null}

      {!error && !empty && showTable && hasTable ? (
        <div className="chart-frame__table-wrap">
          <table className="chart-frame__table">
            <thead>
              <tr>
                {tableColumns.map((c) => (
                  <th key={c.key || c.label}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={row.id ?? i}>
                  {tableColumns.map((c) => (
                    <td key={c.key || c.label}>{row[c.key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
