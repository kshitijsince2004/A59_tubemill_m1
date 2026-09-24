/** Chart theme tokens — read CSS vars at runtime for Recharts. */

function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function chartColors() {
  return {
    series: [
      cssVar('--chart-1', '#163328'),
      cssVar('--chart-2', '#c2410c'),
      cssVar('--chart-3', '#3b82f6'),
      cssVar('--chart-4', '#7c3aed'),
      cssVar('--chart-5', '#0d9488'),
    ],
    grid: cssVar('--chart-grid', '#e2e7e5'),
    axis: cssVar('--chart-axis', '#69807a'),
    band: cssVar('--chart-band', 'rgba(34, 197, 94, 0.12)'),
    target: cssVar('--chart-target', '#f1b824'),
    out: cssVar('--chart-out', '#ef4444'),
    good: cssVar('--color-success', '#22c55e'),
    warning: cssVar('--color-warning', '#f59e0b'),
    critical: cssVar('--color-destructive', '#ef4444'),
  };
}

export const CHART_HEIGHT = 260;
