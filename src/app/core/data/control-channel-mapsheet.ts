export const CONTROL_CHANNEL_MAP: Record<string, string> = {
  '61113060-01-001-01': 'Ads',
  '61116000-01-001-01': 'Shipping',
  '61113140-01-001-01': 'Apps/Platforms/Agency',
  '61113150-01-001-01': 'Studio',
  '61113160-01-001-01': 'Social Media'
};

/** Resolves spend category from a transaction control code. */
export function resolveControlCategory(
  control: string | undefined | null,
  fallback = 'Uncategorized'
): string {
  const key = control?.trim();
  if (key && CONTROL_CHANNEL_MAP[key]) {
    return CONTROL_CHANNEL_MAP[key];
  }
  return fallback;
}