export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 1234567.5 -> "1,234,567.50" (en-US grouping so tests can strip commas and parse). */
export function money(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}
