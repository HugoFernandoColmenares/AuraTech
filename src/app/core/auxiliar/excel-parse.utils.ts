/** Shared parsers for Excel / POS currency and numeric cells. */

export function parseCurrency(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = parseFloat(String(value).replace(/[$,\s]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

export function parseNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

export function parseInteger(value: unknown): number {
  const n = parseInt(String(value ?? '0'), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Parses numbers that may use comma as decimal separator (e.g. FashionGo exports). */
export function parseDecimalLocale(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  const str = String(value).trim().replace(/[$\s]/g, '').replace(',', '.');
  const n = parseFloat(str);
  return Number.isNaN(n) ? 0 : n;
}
