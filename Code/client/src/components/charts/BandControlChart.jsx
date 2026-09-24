import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Legend,
} from 'recharts';
import ChartFrame from './ChartFrame';
import { chartColors, CHART_HEIGHT } from './chartTheme';

/**
 * Control chart with spec band. seriesKeys: data keys to plot as lines.
 * Each point may include outOfBand: true or outKeys: string[].
 * bandMin / bandMax: constant band, or per-row minKey/maxKey.
 */
export default function BandControlChart({
  title,
  subtitle,
  data = [],
  xKey = 'at',
  seriesKeys = ['value'],
  seriesLabels = {},
  bandMin,
  bandMax,
  minKey,
  maxKey,
  target,
  error,
  className = '',
}) {
  const colors = chartColors();
  const empty = !error && (!data || data.length === 0);
  const keys = seriesKeys.length ? seriesKeys : ['value'];

  const ymin =
    bandMin != null
      ? bandMin
      : Math.min(
          ...data.flatMap((d) => keys.map((k) => Number(d[k])).filter((n) => !Number.isNaN(n))),
          ...data.map((d) => Number(d[minKey])).filter((n) => !Number.isNaN(n))
        );
  const ymax =
    bandMax != null
      ? bandMax
      : Math.max(
          ...data.flatMap((d) => keys.map((k) => Number(d[k])).filter((n) => !Number.isNaN(n))),
          ...data.map((d) => Number(d[maxKey])).filter((n) => !Number.isNaN(n))
        );

  const tableColumns = [
    { key: xKey, label: 'At' },
    ...keys.map((k) => ({ key: k, label: seriesLabels[k] || k })),
  ];

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      error={error}
      empty={empty}
      tableColumns={tableColumns}
      tableRows={(data || []).map((d, i) => ({ id: i, ...d }))}
      className={className}
      legend={
        keys.length >= 2 ? (
          <span className="chart-frame__legend muted">
            {keys.map((k) => (
              <span key={k} style={{ marginLeft: 8 }}>
                {seriesLabels[k] || k}
              </span>
            ))}
          </span>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT + (keys.length > 3 ? 40 : 0)}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fill: colors.axis, fontSize: 10 }} />
          <YAxis
            domain={[
              Number.isFinite(ymin) ? ymin * 0.98 : 'auto',
              Number.isFinite(ymax) ? ymax * 1.02 : 'auto',
            ]}
            tick={{ fill: colors.axis, fontSize: 11 }}
            width={48}
          />
          <Tooltip />
          {keys.length >= 2 ? <Legend /> : null}
          {bandMin != null && bandMax != null ? (
            <ReferenceArea y1={bandMin} y2={bandMax} fill={colors.band} strokeOpacity={0} />
          ) : null}
          {target != null ? (
            <ReferenceLine y={target} stroke={colors.target} strokeDasharray="4 4" />
          ) : null}
          {keys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={seriesLabels[k] || k}
              stroke={colors.series[i % colors.series.length]}
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return null;
                const out =
                  payload?.outOfBand ||
                  (Array.isArray(payload?.outKeys) && payload.outKeys.includes(k)) ||
                  (bandMin != null &&
                    bandMax != null &&
                    (Number(payload?.[k]) < bandMin || Number(payload?.[k]) > bandMax));
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={out ? 5 : 3}
                    fill={out ? colors.out : colors.series[i % colors.series.length]}
                    stroke={out ? colors.out : 'none'}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
