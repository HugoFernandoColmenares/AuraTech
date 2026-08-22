export interface RevenueTrendSummary {
  value: number;
  percentage: number;
  isPositive: boolean;
  currentYear?: number;
  currentMonth?: number;
  compareYear?: number;
  currentTotal: number;
  compareTotal: number;
  status?: 'complete' | 'no_compare_data' | 'no_current_data' | 'no_data';
  statusMessage?: string | null;
}

export type ViewMode = 'table' | 'charts' | 'insights';

export type Granularity = 'week' | 'month' | 'year';

export type ProductGrouping = 'sku' | 'parent' | 'parent-color' | 'parent-size' | 'brand' | 'brand-color' | 'brand-size' | 'collection' | 'collection-color' | 'collection-size' | 'type' | 'division';

export type ChartKey = 'monthly' | 'warehouse' | 'account' | 'units' | 'state' | 'products' | 'comparison' | 'category' | 'channel' | 'yoy' | 'macro' | 'brand' | 'collection' | 'type' | 'division';

export interface ChartConfig<T = string> {
  key: T;
  label: string;
  icon: string;
}

export type ChartJsChartType = 'line' | 'bar' | 'pie' | 'doughnut';

/** Minimal Chart.js config shape returned by ChartGeneratorService / SalesChartBuilderService. */
export interface ChartJsConfig {
  type: ChartJsChartType;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
}
