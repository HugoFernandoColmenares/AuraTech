/** ISO timestamp for Jan 1 of the prior calendar year — enough for YoY KPIs. */
export function yoyAnalyticsWindowStartIso(): string {
  const year = new Date().getFullYear() - 1;
  return `${year}-01-01T00:00:00.000Z`;
}

/** Filter demo/local rows to the same YoY window used for Supabase fetches. */
export function isOnOrAfterIsoDate(value: Date | string | null | undefined, minIso: string): boolean {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= new Date(minIso).getTime();
}
