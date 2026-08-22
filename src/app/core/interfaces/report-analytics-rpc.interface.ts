/** Raw KPI totals returned by Postgres RPC (percentages/status computed client-side). */
export interface RpcKpiTotals {
  current_total: number;
  compare_total: number;
  current_year: number;
  current_month: number;
  compare_year: number;
}

export interface SalesAnalyticsRpcResponse {
  kpis: {
    revenue_trend: RpcKpiTotals;
    units_trend: RpcKpiTotals;
    year_revenue: RpcKpiTotals;
    year_units: RpcKpiTotals;
  };
  monthly: SalesMonthlyAggregateRpc[];
  by_channel: { channel: string; revenue: number }[];
  top_skus: { sku: string; quantity: number; revenue: number }[];
  available_accounts: string[];
}

export interface SalesMonthlyAggregateRpc {
  audit_year: number;
  audit_month: number;
  account: string;
  channel: string;
  category: string;
  revenue: number;
  units: number;
}

export const SUPABASE_RPC = {
  salesAnalytics: 'get_sales_analytics',
  refreshSaleRecordsAnalytics: 'refresh_sale_records_analytics',
} as const;
