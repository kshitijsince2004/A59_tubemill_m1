import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import ChartFrame from './ChartFrame';
import { chartColors, CHART_HEIGHT } from './chartTheme';

/**
 * Ranked descending bars. Optional cumulative % as point labels (no second axis).
 */
export default function ParetoBar({
  title,
  subtitle,
  data = [],
  nameKey = 'label',
  valueKey = 'value',
  showCumulative = true,
  error,
  horizontal = true,
  className = '',
}) {
  const colors = chartColors();
  const ranked = [...(data || [])].sort(
    (a, b) => Number(b[valueKey] ?? 0) - Number(a[valueKey] ?? 0)
  );
  const total = ranked.reduce((s, r) => s + Number(r[valueKey] ?? 0), 0);
  let run = 0;
  const series = ranked.map((r) => {
    run += Number(r[valueKey] ?? 0);
    return {
      ...r,
      _cumPct: total > 0 ? Math.round((run / total) * 1000) / 10 : 0,
    };
  });
  const empty = !error && series.length === 0;

  const tableColumns = [
    { key: nameKey, label: 'Code' },
    { key: valueKey, label: 'Value' },
    ...(showCumulative ? [{ key: '_cumPct', label: 'Cumulative %' }] : []),
  ];

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      error={error}
      empty={empty}
      tableColumns={tableColumns}
      tableRows={series.map((r, i) => ({ id: i, ...r }))}
      className={className}
    >
      <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, series.length * 28)}>
        <BarChart
          data={series}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 40, left: 8, bottom: 0 }}
        >
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fill: colors.axis, fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey={nameKey}
                width={100}
                tick={{ fill: colors.axis, fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={nameKey} tick={{ fill: colors.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: colors.axis, fontSize: 11 }} width={48} />
            </>
          )}
          <Tooltip
            formatter={(v, name) => {
              if (name === '_cumPct') return [`${v}%`, 'Cumulative'];
              return [v, 'Value'];
            }}
          />
          <Bar dataKey={valueKey} fill={colors.series[0]} radius={[0, 4, 4, 0]} name="Value">
            {showCumulative ? (
              <LabelList
                dataKey="_cumPct"
                position="right"
                formatter={(v) => `${v}%`}
                style={{ fill: colors.axis, fontSize: 10 }}
              />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
