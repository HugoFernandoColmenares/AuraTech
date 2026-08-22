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

export interface CreditCardAnalyticsRpcResponse {
  kpis: {
    last_month: {
      amount: number;
      year: number;
      month: number;
      transaction_count: number;
    };
    month_trend: RpcKpiTotals;
    year_comparison: RpcKpiTotals;
  };
  monthly: CreditCardMonthlyAggregateRpc[];
  available_years: number[];
}

export interface CreditCardMonthlyAggregateRpc {
  year: number;
  month: number;
  category: string;
  channel: string;
  control: string;
  amount: number;
  tx_count: number;
}

export interface InventoryAnalyticsRpcResponse {
  kpis: {
    total_available: number;
    total_on_hand: number;
    sku_count: number;
    urgent_count: number;
    priority_count: number;
  };
  by_division: { division: string; available: number; on_hand: number }[];
  by_type: { type: string; available: number; on_hand: number }[];
  by_brand: { brand: string; available: number; on_hand: number }[];
}

export const SUPABASE_RPC = {
  salesAnalytics: 'get_sales_analytics',
  creditCardAnalytics: 'get_credit_card_analytics',
  inventoryAnalytics: 'get_inventory_analytics',
  cureSaleRecords: 'cure_sale_records',
  refreshSaleRecordsAnalytics: 'refresh_sale_records_analytics',
} as const;
