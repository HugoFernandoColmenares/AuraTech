import {
  getCreditCardMonth,
  getCreditCardYear,
  getCreditCardYearMonthOrdinal,
  previousStatementMonth,
} from '@core/auxiliar/credit-card-date.util';
import { DateUtils } from '@core/auxiliar/date.utils';
import { formatYtdComparisonPeriodLabel } from '@core/auxiliar/sales-yoy.util';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';

export type CreditCardKpiStatus = 'complete' | 'no_compare_data' | 'no_current_data' | 'no_data';

export interface CreditCardKpiSummary {
  value: number;
  percentage: number;
  isPositive: boolean;
  currentYear: number;
  currentMonth: number;
  compareYear: number;
  currentTotal: number;
  compareTotal: number;
  status: CreditCardKpiStatus;
  statusMessage: string | null;
}

export interface CreditCardLastMonthSummary {
  amount: number;
  year: number;
  month: number;
  transactionCount: number;
  periodLabel: string;
  status: CreditCardKpiStatus;
  statusMessage: string | null;
}

export interface CreditCardYearComparison extends CreditCardKpiSummary {
  scopeLabel: string;
}

const EMPTY_SUMMARY: CreditCardKpiSummary = {
  value: 0,
  percentage: 0,
  isPositive: true,
  currentYear: 0,
  currentMonth: 0,
  compareYear: 0,
  currentTotal: 0,
  compareTotal: 0,
  status: 'no_data',
  statusMessage: 'No transactions match the current filters.',
};

function resolveStatus(currentTotal: number, compareTotal: number): {
  status: CreditCardKpiStatus;
  statusMessage: string | null;
} {
  if (currentTotal === 0 && compareTotal === 0) {
    return { status: 'no_data', statusMessage: 'No transactions match the current filters.' };
  }
  if (currentTotal === 0) {
    return { status: 'no_current_data', statusMessage: 'No spend for the selected period.' };
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
  return Math.abs((currentTotal - compareTotal) / compareTotal) * 100;
}

/** Focus year for KPIs — aligns with pivot year selector (defaults to latest selected year). */
export function resolveCreditCardFocusYear(
  selectedYears: number[],
  records: ICreditCardTransactionDto[]
): number {
  if (selectedYears.length) {
    return Math.max(...selectedYears);
  }
  if (!records.length) {
    return DateUtils.now().getFullYear();
  }
  return Math.max(...records.map(getCreditCardYear));
}

function latestPeriodInYear(
  records: ICreditCardTransactionDto[],
  year: number
): { year: number; month: number } | null {
  let best: { year: number; month: number; ord: number } | null = null;

  for (const record of records) {
    if (getCreditCardYear(record) !== year) continue;
    const ord = getCreditCardYearMonthOrdinal(record);
    if (!best || ord > best.ord) {
      best = { year: getCreditCardYear(record), month: getCreditCardMonth(record), ord };
    }
  }

  return best ? { year: best.year, month: best.month } : null;
}

function sumMonthSpend(
  records: ICreditCardTransactionDto[],
  year: number,
  month: number
): number {
  let total = 0;
  for (const record of records) {
    if (getCreditCardYear(record) === year && getCreditCardMonth(record) === month) {
      total += record.amount;
    }
  }
  return total;
}

function countMonthTransactions(
  records: ICreditCardTransactionDto[],
  year: number,
  month: number
): number {
  return records.filter(
    r => getCreditCardYear(r) === year && getCreditCardMonth(r) === month
  ).length;
}

/** Calendar month before the latest statement month in the focus year (filtered scope). */
export function computeLastMonthSpendKpi(
  filtered: ICreditCardTransactionDto[],
  focusYear: number
): CreditCardLastMonthSummary {
  if (!filtered.length) {
    return {
      amount: 0,
      year: 0,
      month: 0,
      transactionCount: 0,
      periodLabel: 'No data',
      status: 'no_data',
      statusMessage: 'No transactions match the current filters.',
    };
  }

  const latest = latestPeriodInYear(filtered, focusYear);
  if (!latest) {
    return {
      amount: 0,
      year: 0,
      month: 0,
      transactionCount: 0,
      periodLabel: 'No data',
      status: 'no_current_data',
      statusMessage: `No transactions in ${focusYear} for the current filters.`,
    };
  }

  const prior = previousStatementMonth(latest.year, latest.month);
  const amount = sumMonthSpend(filtered, prior.year, prior.monthIndex);
  const transactionCount = countMonthTransactions(filtered, prior.year, prior.monthIndex);

  return {
    amount,
    year: prior.year,
    month: prior.monthIndex,
    transactionCount,
    periodLabel: `${DateUtils.getMonthLabel(prior.monthIndex)} ${prior.year}`,
    status: amount === 0 ? 'no_current_data' : 'complete',
    statusMessage: amount === 0 ? 'No spend recorded for the prior statement month.' : null,
  };
}

/** Same statement month YoY — latest month in focus year vs prior year (loads LY from full session when filtered). */
export function computeMonthSpendTrendKpi(
  filtered: ICreditCardTransactionDto[],
  allRecords: ICreditCardTransactionDto[],
  focusYear: number,
  hasDateFilter: boolean
): CreditCardKpiSummary {
  if (!filtered.length) return { ...EMPTY_SUMMARY };

  const latest = latestPeriodInYear(filtered, focusYear);
  if (!latest) return { ...EMPTY_SUMMARY, status: 'no_current_data', statusMessage: 'No spend for the selected period.' };

  const compareYear = latest.year - 1;
  const currentTotal = sumMonthSpend(filtered, latest.year, latest.month);
  const compareSource = hasDateFilter ? allRecords : filtered;
  const compareTotal = sumMonthSpend(compareSource, compareYear, latest.month);

  const diff = currentTotal - compareTotal;
  const { status, statusMessage } = resolveStatus(currentTotal, compareTotal);

  return {
    value: diff,
    percentage: buildPercentage(currentTotal, compareTotal),
    isPositive: diff <= 0,
    currentYear: latest.year,
    currentMonth: latest.month,
    compareYear,
    currentTotal,
    compareTotal,
    status,
    statusMessage,
  };
}

function sumYtdSpend(
  records: ICreditCardTransactionDto[],
  year: number,
  throughMonthIndex: number
): number {
  let total = 0;
  for (const record of records) {
    if (
      getCreditCardYear(record) === year &&
      getCreditCardMonth(record) <= throughMonthIndex
    ) {
      total += record.amount;
    }
  }
  return total;
}

/** Full calendar-year spend — focus year (filtered) vs prior year (full session when date filter active). */
export function computeYearSpendComparison(
  filtered: ICreditCardTransactionDto[],
  allRecords: ICreditCardTransactionDto[],
  focusYear: number,
  hasDateFilter: boolean
): CreditCardYearComparison {
  if (!filtered.length) {
    return { ...EMPTY_SUMMARY, scopeLabel: 'SPEND' };
  }

  const currentYear = focusYear;
  const compareYear = currentYear - 1;

  let currentTotal: number;
  let compareTotal: number;
  let throughMonthIndex = 0;

  if (hasDateFilter) {
    currentTotal = filtered.reduce((sum, r) => sum + r.amount, 0);
    const periods = new Set<string>();
    for (const record of filtered) {
      periods.add(`${getCreditCardYear(record)}-${getCreditCardMonth(record)}`);
    }
    compareTotal = 0;
    for (const key of periods) {
      const [year, month] = key.split('-').map(Number);
      compareTotal += sumMonthSpend(allRecords, year - 1, month);
      if (year === currentYear) {
        throughMonthIndex = Math.max(throughMonthIndex, month);
      }
    }
  } else {
    const latest = latestPeriodInYear(filtered, focusYear);
    if (!latest) {
      return {
        ...EMPTY_SUMMARY,
        scopeLabel: 'SPEND',
        status: 'no_current_data',
        statusMessage: `No transactions in ${focusYear} for the current filters.`,
      };
    }
    throughMonthIndex = latest.month;
    currentTotal = sumYtdSpend(filtered, currentYear, throughMonthIndex);
    compareTotal = sumYtdSpend(allRecords, compareYear, throughMonthIndex);
  }

  const diff = currentTotal - compareTotal;
  const { status, statusMessage } = resolveStatus(currentTotal, compareTotal);

  return {
    value: diff,
    percentage: buildPercentage(currentTotal, compareTotal),
    isPositive: diff <= 0,
    currentYear,
    currentMonth: throughMonthIndex + 1,
    compareYear,
    currentTotal,
    compareTotal,
    status,
    statusMessage,
    scopeLabel: 'SPEND',
  };
}

export function formatSpendTrendPeriodLabel(summary: CreditCardKpiSummary): string {
  if (!summary.currentYear || summary.currentMonth == null) {
    return 'No data';
  }
  const label = DateUtils.getMonthLabel(summary.currentMonth);
  return `${label} ${summary.currentYear} vs ${label} ${summary.compareYear}`;
}

export function formatYearSpendPeriodLabel(
  currentYear: number,
  compareYear: number,
  throughMonth = 0
): string {
  return formatYtdComparisonPeriodLabel(currentYear, compareYear, throughMonth);
}
