import { ChartConfig, ChartKey } from '@core/interfaces/chart.interface';

export const CHART_CONFIGS: ChartConfig<ChartKey>[] = [
  { key: 'yoy', label: 'Yearly Comparison', icon: '📅' },
  { key: 'products', label: 'Top Products', icon: '🏷️' },
];
