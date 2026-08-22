import { DateUtils } from '@core/auxiliar/date.utils';
import {
  CreditCardLastMonthSummary,
  CreditCardKpiSummary,
  CreditCardYearComparison,
} from '@core/auxiliar/credit-card-kpi.util';
import {
  RpcKpiTotals,
  SalesMonthlyAggregateRpc,
  CreditCardMonthlyAggregateRpc,
} from '@core/interfaces/report-analytics-rpc.interface';
import { YoyKpiSummary, YearScopeComparison, YoyDataStatus } from '@core/auxiliar/sales-yoy.util';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';
import { SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';
import {
  INVENTORY_PRIORITY_THRESHOLD,
  INVENTORY_URGENT_THRESHOLD,
} from '@core/constants/inventory-thresholds.const';

function resolveStatus(
  currentTotal: number,
  compareTotal: number
): { status: YoyDataStatus; statusMessage: string | null } {
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
  return Math.abs(((currentTotal - compareTotal) / compareTotal) * 100);
}

export function mapRpcTotalsToYoyKpi(
  raw: RpcKpiTotals,
  positiveWhenIncrease: boolean
): YoyKpiSummary {
  const diff = raw.current_total - raw.compare_total;
  const { status, statusMessage } = resolveStatus(raw.current_total, raw.compare_total);
  return {
    value: diff,
    percentage: buildPercentage(raw.current_total, raw.compare_total),
    isPositive: positiveWhenIncrease ? diff >= 0 : diff <= 0,
    currentYear: raw.current_year,
    currentMonth: raw.current_month,
    compareYear: raw.compare_year,
    currentTotal: raw.current_total,
    compareTotal: raw.compare_total,
    status,
    statusMessage,
  };
}

export function mapRpcTotalsToYearComparison(
  raw: RpcKpiTotals,
  scopeLabel: string,
  positiveWhenIncrease: boolean
): YearScopeComparison {
  const base = mapRpcTotalsToYoyKpi(raw, positiveWhenIncrease);
  return { ...base, scopeLabel };
}

export function salesFiltersToRpcPayload(filters: SalesFilters): Record<string, unknown> {
  return {
    accounts: filters.account ?? [],
    search: filters.search ?? '',
    start_date: filters.startDate ? DateUtils.formatUtcDateString(filters.startDate) : '',
    end_date: filters.endDate ? DateUtils.formatUtcDateString(filters.endDate) : '',
    months: filters.months ?? [],
  };
}

export function creditCardFiltersToRpcPayload(options: {
  search: string;
  startDate: string;
  endDate: string;
  focusYear: number;
}): Record<string, unknown> {
  return {
    search: options.search ?? '',
    start_date: options.startDate ?? '',
    end_date: options.endDate ?? '',
    focus_year: options.focusYear,
  };
}

export function inventoryFiltersToRpcPayload(filters: {
  search: string;
  division: string;
  type: string;
  excludeZeroAvailable: boolean;
  excludeZeroOnHand: boolean;
}): Record<string, unknown> {
  return {
    search: filters.search ?? '',
    division: filters.division ?? '',
    type: filters.type ?? '',
    exclude_zero_available: filters.excludeZeroAvailable ?? true,
    exclude_zero_on_hand: filters.excludeZeroOnHand ?? true,
    urgent_threshold: INVENTORY_URGENT_THRESHOLD,
    priority_threshold: INVENTORY_PRIORITY_THRESHOLD,
  };
}

export function salesAggregatesToRecords(rows: SalesMonthlyAggregateRpc[]): ISaleRecordDto[] {
  return rows.map((row, index) => ({
    id: `agg-${row.audit_year}-${row.audit_month}-${row.account}-${row.channel ?? 'na'}-${row.category ?? 'na'}-${index}`,
    orderId: '',
    idx: 0,
    orderStatus: '',
    warehouseCode: 'GEN',
    account: row.account ?? '',
    channel: row.channel,
    category: (row.category === 'Wholesale' ? 'Wholesale' : 'Retail') as 'Retail' | 'Wholesale',
    orderPlaceDate: new Date(Date.UTC(row.audit_year, row.audit_month - 1, 1)),
    sku: 'AGG',
    itemCost: 0,
    itemQuantity: Number(row.units) || 0,
    total: Number(row.revenue) || 0,
    auditYear: row.audit_year,
    auditMonth: row.audit_month,
    isLocal: false,
  }));
}

export function creditCardAggregatesToTransactions(
  rows: CreditCardMonthlyAggregateRpc[]
): ICreditCardTransactionDto[] {
  return rows.map((row, index) => ({
    id: `agg-${row.year}-${row.month}-${row.category}-${row.channel}-${row.control ?? 'na'}-${index}`,
    date: new Date(Date.UTC(row.year, row.month, 1)),
    receipt: null,
    description: row.category,
    cardMember: '',
    accountNumberSuffix: '',
    amount: Number(row.amount) || 0,
    extendedDetails: '',
    statementDescription: '',
    address: '',
    cityState: '',
    zipCode: '',
    country: '',
    referenceNumber: '',
    category: row.category,
    channel: row.channel,
    salesChannel: row.channel,
    dept: '',
    control: row.control,
    auditYear: row.year,
    auditMonth: row.month + 1,
  }));
}

export function mapRpcLastMonthKpi(raw: {
  amount: number;
  year: number;
  month: number;
  transaction_count: number;
}): CreditCardLastMonthSummary {
  const amount = Number(raw.amount) || 0;
  return {
    amount,
    year: raw.year,
    month: raw.month,
    transactionCount: Number(raw.transaction_count) || 0,
    periodLabel:
      raw.year && raw.month
        ? `${DateUtils.getMonthLabel(raw.month)} ${raw.year}`
        : 'No data',
    status: amount === 0 ? 'no_current_data' : 'complete',
    statusMessage: amount === 0 ? 'No spend recorded for the prior statement month.' : null,
  };
}

export function mapRpcCreditCardTrend(raw: RpcKpiTotals): CreditCardKpiSummary {
  return mapRpcTotalsToYoyKpi(raw, false);
}

export function mapRpcCreditCardYearComparison(raw: RpcKpiTotals): CreditCardYearComparison {
  return { ...mapRpcCreditCardTrend(raw), scopeLabel: 'SPEND' };
}
