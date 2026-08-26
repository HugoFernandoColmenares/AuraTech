import { ISaleRecordDto, SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import { DateUtils } from '@core/auxiliar/date.utils';
import { PIVOT_MONTHS } from '@core/constants';

export function toISOWeek(date: Date): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return DateUtils.getISOWeekKey(date);
}

export function filterValidSalesOrders(data: ISaleRecordDto[]): ISaleRecordDto[] {
  return data.filter(r => {
    if (r.warehouseCode === 'GEN') return true;
    if (!r.orderStatus) return true;
    const status = r.orderStatus.toLowerCase().trim();
    return !(
      status.includes('cancel') ||
      status.includes('refund') ||
      status.includes('void') ||
      status.includes('return')
    );
  });
}

export function getStoredAuditMonth(r: ISaleRecordDto): number | null {
  if (r.auditMonth === undefined || r.auditMonth === null || String(r.auditMonth).trim() === '') {
    return null;
  }
  const parsed = Number(r.auditMonth);
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
  const numStr = parseInt(String(r.auditMonth).trim(), 10);
  if (!Number.isNaN(numStr) && numStr >= 1 && numStr <= 12) return numStr;
  return null;
}

export function getStoredAuditYear(r: ISaleRecordDto): number | null {
  if (r.auditYear === undefined || r.auditYear === null || String(r.auditYear).trim() === '') {
    return null;
  }
  const parsed = Number(r.auditYear);
  if (!Number.isNaN(parsed) && parsed > 1900) return parsed;
  return null;
}

export function getOrderPlaceUtcMonth(r: ISaleRecordDto): number | null {
  const date = DateUtils.parseDate(r.orderPlaceDate);
  if (!date) return null;
  return date.getUTCMonth() + 1;
}

export function getOrderPlaceUtcYear(r: ISaleRecordDto): number | null {
  const date = DateUtils.parseDate(r.orderPlaceDate);
  if (!date) return null;
  return date.getUTCFullYear();
}

export function getEffectiveAuditMonth(r: ISaleRecordDto): number {
  return getStoredAuditMonth(r) ?? getOrderPlaceUtcMonth(r) ?? 1;
}

export function getEffectiveAuditYear(r: ISaleRecordDto): number {
  return getStoredAuditYear(r) ?? getOrderPlaceUtcYear(r) ?? new Date().getUTCFullYear();
}

export function getEffectiveAuditYm(r: ISaleRecordDto): number {
  return getEffectiveAuditYear(r) * 100 + getEffectiveAuditMonth(r);
}

export function getNormalizedAuditMonth(r: ISaleRecordDto): number {
  return getEffectiveAuditMonth(r) - 1;
}

export function getNormalizedAuditYear(r: ISaleRecordDto): number {
  return getEffectiveAuditYear(r);
}

export function auditYmFromFilterDate(date: Date | null): number | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1);
}

export function hasActiveSalesTableFilters(filters: SalesFilters): boolean {
  const months = filters.months ?? [];
  const allMonthsSelected = months.length === 12;
  return !!(
    filters.search?.trim() ||
    filters.account?.length ||
    filters.startDate ||
    filters.endDate ||
    (months.length > 0 && !allMonthsSelected)
  );
}

export function salesTableFiltersCacheKey(filters: SalesFilters): string {
  return JSON.stringify({
    account: filters.account ?? [],
    search: filters.search?.trim() ?? '',
    start: filters.startDate ? DateUtils.formatUtcDateString(filters.startDate) : '',
    end: filters.endDate ? DateUtils.formatUtcDateString(filters.endDate) : '',
    months: filters.months ?? [],
  });
}

type SalesTableQuery = {
  in: (column: string, values: unknown[]) => SalesTableQuery;
  or: (filters: string) => SalesTableQuery;
  gte: (column: string, value: number) => SalesTableQuery;
  lte: (column: string, value: number) => SalesTableQuery;
};

export function applySalesTableFiltersToQuery<Q>(query: Q, filters: SalesFilters): Q {
  let q = query as SalesTableQuery;
  if (filters.account?.length) q = q.in('account', filters.account);
  const search = filters.search?.trim();
  if (search) {
    const term = `%${search}%`;
    q = q.or(`sku.ilike.${term},warehouse_code.ilike.${term},account.ilike.${term}`);
  }
  const months = filters.months ?? [];
  if (months.length > 0 && months.length < 12) q = q.in('am', months.map(m => m + 1));
  const startYm = auditYmFromFilterDate(filters.startDate);
  if (startYm != null) q = q.gte('audit_ym', startYm);
  const endYm = auditYmFromFilterDate(filters.endDate);
  if (endYm != null) q = q.lte('audit_ym', endYm);
  return q as Q;
}

export function filterSaleRecords(data: ISaleRecordDto[], filters: SalesFilters): ISaleRecordDto[] {
  let rows = data;
  const { search, account, startDate, endDate, months } = filters;
  if (account?.length) rows = rows.filter(r => account.includes(r.account || ''));
  if (search) {
    const query = search.toLowerCase();
    rows = rows.filter(
      r =>
        r.sku.toLowerCase().includes(query) ||
        r.warehouseCode.toLowerCase().includes(query) ||
        (r.account && r.account.toLowerCase().includes(query))
    );
  }
  const startYm = auditYmFromFilterDate(startDate);
  if (startYm != null) rows = rows.filter(r => getEffectiveAuditYm(r) >= startYm);
  const endYm = auditYmFromFilterDate(endDate);
  if (endYm != null) rows = rows.filter(r => getEffectiveAuditYm(r) <= endYm);
  if (months?.length) rows = rows.filter(r => months.includes(getNormalizedAuditMonth(r)));
  return rows;
}

export const PG_INT_MAX = 2_147_483_647;
export const PG_INT_MIN = -2_147_483_648;

export function toPgInteger(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return fallback;
  const truncated = Math.trunc(n);
  if (truncated > PG_INT_MAX || truncated < PG_INT_MIN) return fallback;
  return truncated;
}

export function toPgIntegerOptional(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return undefined;
  const truncated = Math.trunc(n);
  if (truncated > PG_INT_MAX || truncated < PG_INT_MIN) return undefined;
  return truncated;
}

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

export interface CurateSalesRecordsOptions {
  dedupe?: boolean;
  preserveIsLocal?: boolean;
  markLocal?: boolean;
}

const DEFAULT_OPTIONS: Required<CurateSalesRecordsOptions> = {
  dedupe: false,
  preserveIsLocal: false,
  markLocal: false,
};

export function isOrderFinancialSummaryRow(record: ISaleRecordDto): boolean {
  if (record.sku === 'AGG') return false;
  if ((record.idx ?? 0) !== 0) return false;
  return record.orderStatus?.toLowerCase().trim() === 'paid';
}

export function salesRecordSummaryCollisionKey(record: ISaleRecordDto): string {
  const year = normalizeSalesAuditYear(record);
  const month = normalizeSalesAuditMonth(record);
  return [String(record.orderId ?? '').trim(), String(record.sku ?? '').trim(), year ?? '', month ?? ''].join('|');
}

export function isPreAggregatedSaleRow(record: ISaleRecordDto): boolean {
  if (record.sku !== 'AGG') return false;
  if (String(record.id ?? '').startsWith('agg-')) return false;
  return true;
}

export function dropPreAggregatedRows(records: ISaleRecordDto[]): ISaleRecordDto[] {
  return records.filter(row => !isPreAggregatedSaleRow(row));
}

export function countPreAggregatedUploadRows(records: ISaleRecordDto[]): number {
  return records.filter(isPreAggregatedSaleRow).length;
}

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

export function salesRecordBusinessKey(record: ISaleRecordDto): string {
  if (record.sku === 'AGG') return record.id;
  return [
    String(record.orderId ?? '').trim(),
    String(record.sku ?? '').trim(),
    record.idx ?? 0,
    normalizeSalesAuditYear(record),
    normalizeSalesAuditMonth(record),
    record.itemQuantity ?? 0,
    Number(record.total ?? 0).toFixed(2),
    String(record.account ?? '').trim(),
  ].join('|');
}

export function normalizeSalesAuditYear(record: ISaleRecordDto): number | undefined {
  const explicit = toPgIntegerOptional(record.auditYear);
  if (explicit !== undefined && explicit > 1900) return explicit;
  const date = DateUtils.parseDate(record.orderPlaceDate);
  return date ? DateUtils.getYearKey(date) : undefined;
}

export function normalizeSalesAuditMonth(record: ISaleRecordDto): number | undefined {
  const explicit = toPgIntegerOptional(record.auditMonth);
  if (explicit !== undefined && explicit >= 1 && explicit <= 12) return explicit;
  const date = DateUtils.parseDate(record.orderPlaceDate);
  return date ? DateUtils.getMonthKey(date) + 1 : undefined;
}

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
  if (opts.markLocal) curated.isLocal = true;
  else if (!opts.preserveIsLocal) curated.isLocal = false;
  return curated;
}

export function curateSalesRecords(
  records: ISaleRecordDto[],
  options: CurateSalesRecordsOptions = {}
): ISaleRecordDto[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let curated = filterValidSalesOrders(records.map(row => curateSalesRecord(row, opts)));
  curated = dropPreAggregatedRows(curated);
  curated = dropOrderSummaryDuplicates(curated);
  curated = collapseDuplicateLineRows(curated);
  if (!opts.dedupe) return curated;
  const seen = new Map<string, ISaleRecordDto>();
  for (const row of curated) {
    const key = salesRecordBusinessKey(row);
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}

export type YoyDataStatus = 'complete' | 'no_compare_data' | 'no_current_data' | 'no_data';

export interface YoyKpiSummary {
  value: number;
  percentage: number;
  isPositive: boolean;
  currentYear: number;
  currentMonth: number;
  compareYear: number;
  currentTotal: number;
  compareTotal: number;
  status: YoyDataStatus;
  statusMessage: string | null;
}

export interface YearScopeComparison extends YoyKpiSummary {
  scopeLabel: string;
}

interface AuditPeriod {
  year: number;
  month: number;
}

const EMPTY_YOY: YoyKpiSummary = {
  value: 0,
  percentage: 0,
  isPositive: true,
  currentYear: 0,
  currentMonth: 0,
  compareYear: 0,
  currentTotal: 0,
  compareTotal: 0,
  status: 'no_data',
  statusMessage: 'No records match the current filters.',
};

function monthLabel(month: number): string {
  return PIVOT_MONTHS[month - 1]?.label ?? String(month);
}

function collectAuditPeriods(records: ISaleRecordDto[]): AuditPeriod[] {
  const map = new Map<string, AuditPeriod>();
  for (const record of records) {
    const year = Number(record.auditYear);
    const month = Number(record.auditMonth);
    if (!Number.isNaN(year) && year > 1900 && !Number.isNaN(month) && month >= 1 && month <= 12) {
      map.set(`${year}-${month}`, { year, month });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
}

function hasDateRangeFilter(filters: SalesFilters): boolean {
  return !!(filters.startDate || filters.endDate);
}

function resolveReferencePeriods(periods: AuditPeriod[], filters: SalesFilters): AuditPeriod[] {
  if (!periods.length) return [];
  if (hasDateRangeFilter(filters)) return periods;
  const currentYear = Math.max(...periods.map(p => p.year));
  return periods.filter(p => p.year === currentYear);
}

export function applyNonDateSalesFilters(data: ISaleRecordDto[], filters: SalesFilters): ISaleRecordDto[] {
  let rows = data;
  const { search, account, months } = filters;
  if (account?.length) rows = rows.filter(r => account.includes(r.account || ''));
  if (search) {
    const query = search.toLowerCase();
    rows = rows.filter(
      r =>
        r.sku.toLowerCase().includes(query) ||
        r.warehouseCode.toLowerCase().includes(query) ||
        (r.account && r.account.toLowerCase().includes(query))
    );
  }
  if (months?.length) rows = rows.filter(r => months.includes(getNormalizedAuditMonth(r)));
  return rows;
}

function matchesPeriod(record: ISaleRecordDto, period: AuditPeriod): boolean {
  return Number(record.auditYear) === period.year && Number(record.auditMonth) === period.month;
}

export function filterRecordsForYoyAnalysis(
  allRecords: ISaleRecordDto[],
  filters: SalesFilters
): ISaleRecordDto[] {
  const filtered = filterSaleRecords(allRecords, filters);
  const currentPeriods = collectAuditPeriods(filtered);
  if (!currentPeriods.length) return [];
  const comparePeriods = currentPeriods.map(p => ({ year: p.year - 1, month: p.month }));
  const allowed = new Set([...currentPeriods, ...comparePeriods].map(p => `${p.year}-${p.month}`));
  return applyNonDateSalesFilters(allRecords, filters).filter(r => {
    const year = Number(r.auditYear);
    const month = Number(r.auditMonth);
    return allowed.has(`${year}-${month}`);
  });
}

function sumCompareYearTotals(
  allRecords: ISaleRecordDto[],
  filters: SalesFilters,
  currentPeriods: AuditPeriod[],
  getValue: (r: ISaleRecordDto) => number
): number {
  const base = applyNonDateSalesFilters(allRecords, filters);
  let total = 0;
  for (const period of currentPeriods) {
    const compare: AuditPeriod = { year: period.year - 1, month: period.month };
    for (const record of base) {
      if (matchesPeriod(record, compare)) total += getValue(record);
    }
  }
  return total;
}

function sumYtdYearTotal(
  allRecords: ISaleRecordDto[],
  filters: SalesFilters,
  year: number,
  throughMonth: number,
  getValue: (r: ISaleRecordDto) => number
): number {
  if (throughMonth <= 0) return 0;
  const base = applyNonDateSalesFilters(allRecords, filters);
  let total = 0;
  for (const record of base) {
    const ay = Number(record.auditYear);
    const am = Number(record.auditMonth);
    if (ay === year && am >= 1 && am <= throughMonth) total += getValue(record);
  }
  return total;
}

function resolveLatestMonthInYear(periods: AuditPeriod[], year: number): number {
  const inYear = periods.filter(p => p.year === year);
  if (!inYear.length) return 0;
  return Math.max(...inYear.map(p => p.month));
}

function resolveYoyStatus(currentTotal: number, compareTotal: number): {
  status: YoyDataStatus;
  statusMessage: string | null;
} {
  if (currentTotal === 0 && compareTotal === 0) {
    return { status: 'no_data', statusMessage: 'No records match the current filters.' };
  }
  if (currentTotal === 0) {
    return { status: 'no_current_data', statusMessage: 'No data for the selected period.' };
  }
  if (compareTotal === 0) {
    return {
      status: 'no_compare_data',
      statusMessage: 'Prior-year data is not available for this comparison.',
    };
  }
  return { status: 'complete', statusMessage: null };
}

function buildPercentage(currentTotal: number, compareTotal: number): number {
  if (compareTotal === 0) return 0;
  const diff = currentTotal - compareTotal;
  return Math.abs((diff / compareTotal) * 100);
}

export function computeMonthYoyKpi(
  allRecords: ISaleRecordDto[],
  filters: SalesFilters,
  getValue: (r: ISaleRecordDto) => number
): YoyKpiSummary {
  const filtered = filterSaleRecords(allRecords, filters);
  if (!filtered.length) return { ...EMPTY_YOY };
  const periods = collectAuditPeriods(filtered);
  if (!periods.length) return { ...EMPTY_YOY };
  const referencePeriods = resolveReferencePeriods(periods, filters);
  const latest = referencePeriods[referencePeriods.length - 1];
  if (!latest) return { ...EMPTY_YOY };
  const compareYear = latest.year - 1;
  let currentTotal = 0;
  for (const record of filtered) {
    if (matchesPeriod(record, latest)) currentTotal += getValue(record);
  }
  const compareTotal = sumCompareYearTotals(allRecords, filters, [latest], getValue);
  const diff = currentTotal - compareTotal;
  const { status, statusMessage } = resolveYoyStatus(currentTotal, compareTotal);
  return {
    value: diff,
    percentage: buildPercentage(currentTotal, compareTotal),
    isPositive: diff >= 0,
    currentYear: latest.year,
    currentMonth: latest.month,
    compareYear,
    currentTotal,
    compareTotal,
    status,
    statusMessage,
  };
}

export function computeScopedYearComparison(
  allRecords: ISaleRecordDto[],
  filters: SalesFilters,
  getValue: (r: ISaleRecordDto) => number
): YearScopeComparison {
  const filtered = filterSaleRecords(allRecords, filters);
  if (!filtered.length) return { ...EMPTY_YOY, scopeLabel: 'REVENUE' };
  const periods = collectAuditPeriods(filtered);
  if (!periods.length) return { ...EMPTY_YOY, scopeLabel: 'REVENUE' };
  const referencePeriods = resolveReferencePeriods(periods, filters);
  const currentYear = Math.max(...referencePeriods.map(p => p.year));
  const compareYear = currentYear - 1;
  let currentTotal: number;
  let compareTotal: number;
  if (hasDateRangeFilter(filters)) {
    currentTotal = 0;
    for (const record of filtered) currentTotal += getValue(record);
    compareTotal = sumCompareYearTotals(allRecords, filters, periods, getValue);
  } else {
    const latestMonth = resolveLatestMonthInYear(referencePeriods, currentYear);
    currentTotal = sumYtdYearTotal(allRecords, filters, currentYear, latestMonth, getValue);
    compareTotal = sumYtdYearTotal(allRecords, filters, compareYear, latestMonth, getValue);
  }
  const diff = currentTotal - compareTotal;
  const { status, statusMessage } = resolveYoyStatus(currentTotal, compareTotal);
  const account = filters.account;
  const scopeLabel = account?.length === 1 ? `${account[0].toUpperCase()} REVENUE` : 'REVENUE';
  const throughMonth = hasDateRangeFilter(filters)
    ? referencePeriods.length === 1
      ? referencePeriods[0].month
      : resolveLatestMonthInYear(referencePeriods.filter(p => p.year === currentYear), currentYear)
    : resolveLatestMonthInYear(referencePeriods, currentYear);
  return {
    value: diff,
    percentage: buildPercentage(currentTotal, compareTotal),
    isPositive: diff >= 0,
    currentYear,
    currentMonth: throughMonth,
    compareYear,
    currentTotal,
    compareTotal,
    status,
    statusMessage,
    scopeLabel,
  };
}

export function filterPriorYearRowsForScope(
  allRecords: ISaleRecordDto[],
  filters: SalesFilters
): ISaleRecordDto[] {
  const filtered = filterSaleRecords(allRecords, filters);
  const currentPeriods = collectAuditPeriods(filtered);
  if (!currentPeriods.length) return [];
  const base = applyNonDateSalesFilters(allRecords, filters);
  return base.filter(r => {
    const year = Number(r.auditYear);
    const month = Number(r.auditMonth);
    return currentPeriods.some(p => p.year - 1 === year && p.month === month);
  });
}

export function formatYoyPeriodLabel(summary: YoyKpiSummary): string {
  if (!summary.currentYear || !summary.currentMonth) return 'No data';
  const label = monthLabel(summary.currentMonth);
  return `${label} ${summary.currentYear} vs ${label} ${summary.compareYear}`;
}

export function formatYtdComparisonPeriodLabel(
  currentYear: number,
  compareYear: number,
  throughMonth: number
): string {
  if (!currentYear || !compareYear) return 'No data';
  if (!throughMonth || throughMonth < 1 || throughMonth > 12) return `${currentYear} vs ${compareYear}`;
  const endLabel = monthLabel(throughMonth);
  if (throughMonth === 1) return `${endLabel} ${currentYear} vs ${endLabel} ${compareYear}`;
  return `Jan – ${endLabel} ${currentYear} vs Jan – ${endLabel} ${compareYear}`;
}

export function formatScopedPeriodLabel(filters: SalesFilters, filteredCount: number): string {
  if (!filteredCount) return 'No records match the current filters';
  const start = filters.startDate ? DateUtils.parseDate(filters.startDate) : null;
  const end = filters.endDate ? DateUtils.parseDate(filters.endDate) : null;
  if (start && end) {
    const sy = start.getUTCFullYear();
    const sm = start.getUTCMonth() + 1;
    const ey = end.getUTCFullYear();
    const em = end.getUTCMonth() + 1;
    if (sy === ey && sm === em) return `${monthLabel(sm)} ${sy}`;
    return `${monthLabel(sm)} ${sy} – ${monthLabel(em)} ${ey}`;
  }
  return 'Filtered sales records';
}
