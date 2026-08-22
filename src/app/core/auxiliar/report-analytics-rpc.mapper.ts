import { DateUtils } from '@core/auxiliar/date.utils';
import { RpcKpiTotals, SalesMonthlyAggregateRpc } from '@core/interfaces/report-analytics-rpc.interface';
import { YoyKpiSummary, YearScopeComparison, YoyDataStatus } from '@core/auxiliar/sales-yoy.util';
import { ISaleRecordDto, SalesFilters } from '@core/interfaces/ISaleRecordDto.interface';

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
