import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { DateUtils } from '@core/auxiliar/date.utils';

export function toISOWeek(date: Date): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return DateUtils.getISOWeekKey(date);
}

export function filterValidSalesOrders(data: ISaleRecordDto[]): ISaleRecordDto[] {
  return data.filter(r => {
    if (r.warehouseCode === 'GEN') return true;
    if (!r.orderStatus) return true;
    const status = r.orderStatus.toLowerCase().trim();
    return !(status.includes('cancel') || status.includes('refund') || status.includes('void') || status.includes('return'));
  });
}

/** Parsed audit_month column (1–12) when explicitly set; otherwise null. */
export function getStoredAuditMonth(r: ISaleRecordDto): number | null {
  if (r.auditMonth === undefined || r.auditMonth === null || String(r.auditMonth).trim() === '') {
    return null;
  }
  const parsed = Number(r.auditMonth);
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 12) {
    return parsed;
  }
  const numStr = parseInt(String(r.auditMonth).trim(), 10);
  if (!Number.isNaN(numStr) && numStr >= 1 && numStr <= 12) return numStr;
  return null;
}

/** Parsed audit_year column when explicitly set; otherwise null. */
export function getStoredAuditYear(r: ISaleRecordDto): number | null {
  if (r.auditYear === undefined || r.auditYear === null || String(r.auditYear).trim() === '') {
    return null;
  }
  const parsed = Number(r.auditYear);
  if (!Number.isNaN(parsed) && parsed > 1900) return parsed;
  return null;
}

/** UTC month (1–12) from order_place_date; mirrors Postgres EXTRACT(MONTH … AT TIME ZONE 'UTC'). */
export function getOrderPlaceUtcMonth(r: ISaleRecordDto): number | null {
  const date = DateUtils.parseDate(r.orderPlaceDate);
  if (!date) return null;
  return date.getUTCMonth() + 1;
}

/** UTC year from order_place_date; mirrors Postgres EXTRACT(YEAR … AT TIME ZONE 'UTC'). */
export function getOrderPlaceUtcYear(r: ISaleRecordDto): number | null {
  const date = DateUtils.parseDate(r.orderPlaceDate);
  if (!date) return null;
  return date.getUTCFullYear();
}

/** Effective audit month (1–12); matches sale_records.effective_audit_month / sales_audit_ym(). */
export function getEffectiveAuditMonth(r: ISaleRecordDto): number {
  return getStoredAuditMonth(r) ?? getOrderPlaceUtcMonth(r) ?? 1;
}

/** Effective audit year; matches sale_records.effective_audit_year / sales_audit_ym(). */
export function getEffectiveAuditYear(r: ISaleRecordDto): number {
  return getStoredAuditYear(r) ?? getOrderPlaceUtcYear(r) ?? new Date().getUTCFullYear();
}

/** YYYYMM audit period key; matches sale_records.audit_ym and get_sales_analytics filters. */
export function getEffectiveAuditYm(r: ISaleRecordDto): number {
  const month = getEffectiveAuditMonth(r);
  const year = getEffectiveAuditYear(r);
  return year * 100 + month;
}

/** Zero-based month index (0–11) for UI month chips; uses effective audit month. */
export function getNormalizedAuditMonth(r: ISaleRecordDto): number {
  return getEffectiveAuditMonth(r) - 1;
}

export function getNormalizedAuditYear(r: ISaleRecordDto): number {
  return getEffectiveAuditYear(r);
}

/** YYYYMM from a filter boundary date (UTC calendar parts). */
export function auditYmFromFilterDate(date: Date | null): number | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1);
}
