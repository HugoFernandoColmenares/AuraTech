import { ISaleRecordDto, SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import { filterSaleRecords } from '@core/auxiliar/sales-filter.util';
import { getNormalizedAuditMonth, getNormalizedAuditYear } from '@core/auxiliar/sales-audit.utils';
import { DateUtils } from '@core/auxiliar/date.utils';
import { PIVOT_MONTHS } from '@core/constants/pivot.constants';

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

/**
 * Without a date filter, YoY should anchor on the latest audit year (e.g. 2026 vs 2025),
 * not on the chronologically last period across all years (which can be Dec 2025 vs 2024).
 */
function resolveReferencePeriods(periods: AuditPeriod[], filters: SalesFilters): AuditPeriod[] {
  if (!periods.length) return [];
  if (hasDateRangeFilter(filters)) return periods;

  const currentYear = Math.max(...periods.map(p => p.year));
  return periods.filter(p => p.year === currentYear);
}

/** Applies account, search, and month filters — excludes date-range filtering. */
export function applyNonDateSalesFilters(
  data: ISaleRecordDto[],
  filters: SalesFilters
): ISaleRecordDto[] {
  let rows = data;
  const { search, account, months } = filters;

  if (account?.length) {
    rows = rows.filter(r => account.includes(r.account || ''));
  }

  if (search) {
    const query = search.toLowerCase();
    rows = rows.filter(
      r =>
        r.sku.toLowerCase().includes(query) ||
        r.warehouseCode.toLowerCase().includes(query) ||
        (r.account && r.account.toLowerCase().includes(query))
    );
  }

  if (months?.length) {
    rows = rows.filter(r => months.includes(getNormalizedAuditMonth(r)));
  }

  return rows;
}

function matchesPeriod(record: ISaleRecordDto, period: AuditPeriod): boolean {
  return Number(record.auditYear) === period.year && Number(record.auditMonth) === period.month;
}

/**
 * Returns rows for YoY analytics: current filtered periods plus the same audit
 * months one year earlier (date filters define the current scope only).
 */
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
      if (matchesPeriod(record, compare)) {
        total += getValue(record);
      }
    }
  }

  return total;
}

/** Sums audit months from January through `throughMonth` in a calendar year (1–12). */
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
    if (ay === year && am >= 1 && am <= throughMonth) {
      total += getValue(record);
    }
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

/** Same calendar month YoY — latest month in the filtered scope vs prior year. */
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
    if (matchesPeriod(record, latest)) {
      currentTotal += getValue(record);
    }
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

/** Scoped YoY — sums every audit month in the filtered window vs the same months one year earlier. */
export function computeScopedYearComparison(
  allRecords: ISaleRecordDto[],
  filters: SalesFilters,
  getValue: (r: ISaleRecordDto) => number
): YearScopeComparison {
  const filtered = filterSaleRecords(allRecords, filters);
  if (!filtered.length) {
    return { ...EMPTY_YOY, scopeLabel: 'REVENUE' };
  }

  const periods = collectAuditPeriods(filtered);
  if (!periods.length) {
    return { ...EMPTY_YOY, scopeLabel: 'REVENUE' };
  }

  const referencePeriods = resolveReferencePeriods(periods, filters);
  const currentYear = Math.max(...referencePeriods.map(p => p.year));
  const compareYear = currentYear - 1;

  let currentTotal: number;
  let compareTotal: number;

  if (hasDateRangeFilter(filters)) {
    currentTotal = 0;
    for (const record of filtered) {
      currentTotal += getValue(record);
    }
    compareTotal = sumCompareYearTotals(allRecords, filters, periods, getValue);
  } else {
    const latestMonth = resolveLatestMonthInYear(referencePeriods, currentYear);
    currentTotal = sumYtdYearTotal(allRecords, filters, currentYear, latestMonth, getValue);
    compareTotal = sumYtdYearTotal(allRecords, filters, compareYear, latestMonth, getValue);
  }

  const diff = currentTotal - compareTotal;
  const { status, statusMessage } = resolveYoyStatus(currentTotal, compareTotal);

  const account = filters.account;
  const scopeLabel =
    account?.length === 1 ? `${account[0].toUpperCase()} REVENUE` : 'REVENUE';

  const throughMonth = hasDateRangeFilter(filters)
    ? referencePeriods.length === 1
      ? referencePeriods[0].month
      : resolveLatestMonthInYear(
          referencePeriods.filter(p => p.year === currentYear),
          currentYear
        )
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

/** Prior-year rows aligned to the same audit months as the current filtered scope. */
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

/** Formats the YoY period label for KPI cards. */
export function formatYoyPeriodLabel(summary: YoyKpiSummary): string {
  if (!summary.currentYear || !summary.currentMonth) {
    return 'No data';
  }
  const label = monthLabel(summary.currentMonth);
  return `${label} ${summary.currentYear} vs ${label} ${summary.compareYear}`;
}

export function formatYtdComparisonPeriodLabel(
  currentYear: number,
  compareYear: number,
  throughMonth: number
): string {
  if (!currentYear || !compareYear) return 'No data';
  if (!throughMonth || throughMonth < 1 || throughMonth > 12) {
    return `${currentYear} vs ${compareYear}`;
  }
  const endLabel = monthLabel(throughMonth);
  if (throughMonth === 1) {
    return `${endLabel} ${currentYear} vs ${endLabel} ${compareYear}`;
  }
  return `Jan – ${endLabel} ${currentYear} vs Jan – ${endLabel} ${compareYear}`;
}

export function formatScopedPeriodLabel(
  filters: SalesFilters,
  filteredCount: number
): string {
  if (!filteredCount) return 'No records match the current filters';

  const start = filters.startDate ? DateUtils.parseDate(filters.startDate) : null;
  const end = filters.endDate ? DateUtils.parseDate(filters.endDate) : null;

  if (start && end) {
    const sy = start.getUTCFullYear();
    const sm = start.getUTCMonth() + 1;
    const ey = end.getUTCFullYear();
    const em = end.getUTCMonth() + 1;
    if (sy === ey && sm === em) {
      return `${monthLabel(sm)} ${sy}`;
    }
    return `${monthLabel(sm)} ${sy} – ${monthLabel(em)} ${ey}`;
  }

  return 'Filtered sales records';
}
