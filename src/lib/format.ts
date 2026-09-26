export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: n >= 10_000 ? "compact" : "standard" }).format(n);
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}
