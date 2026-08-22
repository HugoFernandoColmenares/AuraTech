import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { DateUtils } from '@core/auxiliar/date.utils';
import { filterValidSalesOrders } from '@core/auxiliar/sales-audit.utils';
import {
  sanitizeSaleRecordForUpload,
  toPgIntegerOptional,
} from '@core/auxiliar/sale-record-sanitize.util';

export interface CurateSalesRecordsOptions {
  /** Drop rows that share the same business key (order + line + audit period). */
  dedupe?: boolean;
  /** Keep {@link ISaleRecordDto.isLocal} when already set; default clears to false for server rows. */
  preserveIsLocal?: boolean;
  /** Mark curated bundled / Excel rows as local. */
  markLocal?: boolean;
}

const DEFAULT_OPTIONS: Required<CurateSalesRecordsOptions> = {
  dedupe: false,
  preserveIsLocal: false,
  markLocal: false,
};

/**
 * Shopify / RMF website exports emit an order-level row (Financial Status = paid, idx clamped to 0)
 * plus line-item rows for the same SKU — double-counts revenue if both are kept.
 */
export function isOrderFinancialSummaryRow(record: ISaleRecordDto): boolean {
  if (record.sku === 'AGG') return false;
  if ((record.idx ?? 0) !== 0) return false;
  return record.orderStatus?.toLowerCase().trim() === 'paid';
}

/** Collision key for summary vs line-item rows (order + SKU + audit period). */
export function salesRecordSummaryCollisionKey(record: ISaleRecordDto): string {
  const year = normalizeSalesAuditYear(record);
  const month = normalizeSalesAuditMonth(record);
  return [
    String(record.orderId ?? '').trim(),
    String(record.sku ?? '').trim(),
    year ?? '',
    month ?? '',
  ].join('|');
}

/** Uploaded monthly subtotals (sku AGG) duplicate line-level rows in analytics. */
export function isPreAggregatedSaleRow(record: ISaleRecordDto): boolean {
  if (record.sku !== 'AGG') return false;
  if (String(record.id ?? '').startsWith('agg-')) return false;
  return true;
}

export function dropPreAggregatedRows(records: ISaleRecordDto[]): ISaleRecordDto[] {
  return records.filter(row => !isPreAggregatedSaleRow(row));
}

/** Counts rows that must never be persisted (sku AGG uploads). */
export function countPreAggregatedUploadRows(records: ISaleRecordDto[]): number {
  return records.filter(isPreAggregatedSaleRow).length;
}

/** Drop paid order-summary rows when line items exist for the same order or collision key. */
export function dropOrderSummaryDuplicates(records: ISaleRecordDto[]): ISaleRecordDto[] {
  const ordersWithLineItems = new Set<string>();
  const lineItemKeys = new Set<string>();
  for (const row of records) {
    if (isOrderFinancialSummaryRow(row)) continue;
    const orderId = String(row.orderId ?? '').trim();
    if (orderId) ordersWithLineItems.add(orderId);
    lineItemKeys.add(salesRecordSummaryCollisionKey(row));
  }

  return records.filter(row => {
    if (!isOrderFinancialSummaryRow(row)) return true;
    const orderId = String(row.orderId ?? '').trim();
    if (orderId && ordersWithLineItems.has(orderId)) return false;
    return !lineItemKeys.has(salesRecordSummaryCollisionKey(row));
  });
}

/** Collapse mirror idx rows for the same order + SKU + audit period. */
export function collapseDuplicateLineRows(records: ISaleRecordDto[]): ISaleRecordDto[] {
  const groups = new Map<string, ISaleRecordDto[]>();

  for (const row of records) {
    const key = [
      String(row.orderId ?? '').trim(),
      String(row.sku ?? '').trim(),
      normalizeSalesAuditYear(row) ?? '',
      normalizeSalesAuditMonth(row) ?? '',
    ].join('|');
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const kept: ISaleRecordDto[] = [];
  for (const rows of groups.values()) {
    if (rows.length === 1) {
      kept.push(rows[0]);
      continue;
    }

    const distinctTotals = new Set(rows.map(row => Number(row.total ?? 0).toFixed(2)));
    const hasSummary = rows.some(isOrderFinancialSummaryRow);
    if (!hasSummary && distinctTotals.size > 1) {
      kept.push(...rows);
      continue;
    }

    const winner = [...rows].sort((a, b) => {
      const aSummary = isOrderFinancialSummaryRow(a) ? 1 : 0;
      const bSummary = isOrderFinancialSummaryRow(b) ? 1 : 0;
      if (aSummary !== bSummary) return aSummary - bSummary;
      return (b.idx ?? 0) - (a.idx ?? 0);
    })[0];
    kept.push(winner);
  }

  return kept;
}

/** Stable dedupe key — matches how Excel uploads identify a line item. */
export function salesRecordBusinessKey(record: ISaleRecordDto): string {
  if (record.sku === 'AGG') {
    return record.id;
  }

  const year = normalizeSalesAuditYear(record);
  const month = normalizeSalesAuditMonth(record);

  return [
    String(record.orderId ?? '').trim(),
    String(record.sku ?? '').trim(),
    record.idx ?? 0,
    year,
    month,
    record.itemQuantity ?? 0,
    Number(record.total ?? 0).toFixed(2),
    String(record.account ?? '').trim(),
  ].join('|');
}

/** Audit year — prefers explicit auditYear, then orderPlaceDate (UTC). */
export function normalizeSalesAuditYear(record: ISaleRecordDto): number | undefined {
  const explicit = toPgIntegerOptional(record.auditYear);
  if (explicit !== undefined && explicit > 1900) {
    return explicit;
  }

  const date = DateUtils.parseDate(record.orderPlaceDate);
  return date ? DateUtils.getYearKey(date) : undefined;
}

/** Audit month 1–12 — prefers explicit auditMonth, then orderPlaceDate (UTC). */
export function normalizeSalesAuditMonth(record: ISaleRecordDto): number | undefined {
  const explicit = toPgIntegerOptional(record.auditMonth);
  if (explicit !== undefined && explicit >= 1 && explicit <= 12) {
    return explicit;
  }

  const date = DateUtils.parseDate(record.orderPlaceDate);
  return date ? DateUtils.getMonthKey(date) + 1 : undefined;
}

/** Single-row normalization (dates, audit period, PG-safe integers, valid orders). */
export function curateSalesRecord(
  record: ISaleRecordDto,
  options: CurateSalesRecordsOptions = {}
): ISaleRecordDto {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const orderPlaceDate = DateUtils.parseDate(record.orderPlaceDate);

  let curated: ISaleRecordDto = {
    ...record,
    orderPlaceDate,
    orderId: String(record.orderId ?? '').trim(),
    sku: String(record.sku ?? '').trim(),
    account: String(record.account ?? '').trim(),
    warehouseCode: String(record.warehouseCode ?? '').trim(),
    orderStatus: String(record.orderStatus ?? '').trim(),
    category: record.category === 'Wholesale' ? 'Wholesale' : 'Retail',
  };

  const auditYear = normalizeSalesAuditYear(curated);
  const auditMonth = normalizeSalesAuditMonth(curated);
  if (auditYear !== undefined) curated.auditYear = auditYear;
  else delete curated.auditYear;
  if (auditMonth !== undefined) curated.auditMonth = auditMonth;
  else delete curated.auditMonth;

  curated = sanitizeSaleRecordForUpload(curated);

  if (opts.markLocal) {
    curated.isLocal = true;
  } else if (!opts.preserveIsLocal) {
    curated.isLocal = false;
  }

  return curated;
}

/** Batch curation used by Excel imports, bundled JSON, Supabase reads, and export. */
export function curateSalesRecords(
  records: ISaleRecordDto[],
  options: CurateSalesRecordsOptions = {}
): ISaleRecordDto[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let curated = filterValidSalesOrders(records.map(row => curateSalesRecord(row, opts)));
  curated = dropPreAggregatedRows(curated);
  curated = dropOrderSummaryDuplicates(curated);
  curated = collapseDuplicateLineRows(curated);

  if (!opts.dedupe) {
    return curated;
  }

  const seen = new Map<string, ISaleRecordDto>();
  for (const row of curated) {
    const key = salesRecordBusinessKey(row);
    if (!seen.has(key)) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}
