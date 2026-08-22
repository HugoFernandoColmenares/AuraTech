import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';

/** Postgres INTEGER bounds (not JS safe-integer bounds). */
export const PG_INT_MAX = 2_147_483_647;
export const PG_INT_MIN = -2_147_483_648;

/** Coerce a value to a Postgres-safe INTEGER or return fallback. */
export function toPgInteger(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const n =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, '').trim());

  if (!Number.isFinite(n)) {
    return fallback;
  }

  const truncated = Math.trunc(n);
  if (truncated > PG_INT_MAX || truncated < PG_INT_MIN) {
    return fallback;
  }

  return truncated;
}

/** Optional integer column — undefined when missing or out of range. */
export function toPgIntegerOptional(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const n =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/,/g, '').trim());

  if (!Number.isFinite(n)) {
    return undefined;
  }

  const truncated = Math.trunc(n);
  if (truncated > PG_INT_MAX || truncated < PG_INT_MIN) {
    return undefined;
  }

  return truncated;
}

/** Normalize sale rows before Supabase upsert (Excel/JSON can produce oversized idx). */
export function sanitizeSaleRecordForUpload(record: ISaleRecordDto): ISaleRecordDto {
  const sanitized: ISaleRecordDto = {
    ...record,
    idx: toPgInteger(record.idx, 0),
    itemQuantity: toPgInteger(record.itemQuantity, 0),
    sku: String(record.sku ?? ''),
  };

  const auditMonth = toPgIntegerOptional(record.auditMonth);
  const auditYear = toPgIntegerOptional(record.auditYear);
  if (auditMonth !== undefined) sanitized.auditMonth = auditMonth;
  else delete sanitized.auditMonth;
  if (auditYear !== undefined) sanitized.auditYear = auditYear;
  else delete sanitized.auditYear;

  if (sanitized.orderPlaceDate instanceof Date && Number.isNaN(sanitized.orderPlaceDate.getTime())) {
    sanitized.orderPlaceDate = null;
  }

  return sanitized;
}
