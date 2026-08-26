import { Injectable, inject } from '@angular/core';
import { ChartJsConfig, ChartKey, Granularity, ProductGrouping } from '@core/interfaces/chart.interface';
import { ChartGeneratorService, GLOBAL_CHART_COLORS } from '@core/services/Utils/chart-generator.service';
import { SalesProcessingService } from '@core/services/Excel/sales-processing.service';
import { ISaleRecordView } from '@core/interfaces/ISaleRecordDto.interface';
import { comparePeriods, groupAndSum } from '@core/auxiliar/data-aggregation.helper';
import { getProductGroupingKey, getTimePeriodKey } from '@core/auxiliar/chart-keys.helper';

export interface ChartBuilderState {
  key: ChartKey;
  granularity: Granularity;
  hasData: boolean;
  productGrouping: ProductGrouping;
  comparisonAccounts: string[];
  comparisonType: 'revenue' | 'units';
  allRowViews: ISaleRecordView[];
  yoyBaseYear: number;
  yoyCompYear: number;
  yoyMetric: 'revenue' | 'units';
  showStyleName?: boolean;
  hideSmallData?: boolean;
  darkText?: boolean;
  showDataLabels?: boolean;
  preAggregatedProducts?: TopProductsTableData[];
  yoySelectedMonths?: number[];
  yoyComparisonData?: { revenue: Map<number, number[]>; units: Map<number, number[]> };
}

export interface TopProductsTableData {
  name: string;
  current: number;
  ly: number;
  diff: number;
  pct: number;
  units: number;
  revenue?: number;
  pctUnits?: number;
  pctRevenue?: number;
}

@Injectable({ providedIn: 'root' })
export class SalesChartBuilderService {
  private chartGenerator = inject(ChartGeneratorService);
  private salesProcessor = inject(SalesProcessingService);

  buildChart(state: ChartBuilderState): ChartJsConfig {
    if (!state.hasData) return { type: 'line', data: {}, options: {} };

    const filterSmall = (data: { label: string; value: number }[]) => {
      if (!state.hideSmallData) return data;
      const total = data.reduce((acc, d) => acc + d.value, 0);
      return data.filter(d => d.value > total * 0.01);
    };

    const config = (() => {
      switch (state.key) {
        case 'units': {
          const data = this.salesProcessor.filteredData().filter(r => r.orderPlaceDate);
          const grouped = groupAndSum(data, r => getTimePeriodKey(r.orderPlaceDate!, state.granularity), r => r.itemQuantity);

          let filtered = filterSmall(grouped.map(g => ({ label: g.key, value: g.total })));
          filtered.sort((a, b) => a.label.localeCompare(b.label));

          return this.chartGenerator.generateBarChart(
            filtered.map(f => f.label), filtered.map(f => f.value),
            'Units Sold', false, [GLOBAL_CHART_COLORS[2]],
            { plugins: { customDataLabels: { format: 'number' } } }
          );
        }

        case 'products': {
          const metric = state.comparisonType;
          const format = metric === 'revenue' ? 'currency' : 'number';
          const chartLabel = metric === 'revenue' ? 'Sales' : 'Units Sold';

          if (state.preAggregatedProducts?.length) {
            const sorted = [...state.preAggregatedProducts].sort((a, b) =>
              metric === 'revenue' ? b.current - a.current : b.units - a.units
            );
            const top10 = sorted.slice(0, 10);
            const labels = top10.map(p => p.name.substring(0, 28) + (p.name.length > 28 ? '…' : ''));
            const values = top10.map(p => metric === 'revenue' ? p.current : p.units);

            return this.chartGenerator.generateBarChart(
              labels, values, chartLabel, true, undefined,
              { plugins: { customDataLabels: { format } } }
            );
          }

          const grouped = groupAndSum(
            state.allRowViews,
            r => getProductGroupingKey(r, state.productGrouping, !!state.showStyleName),
            r => metric === 'revenue' ? r.total : r.itemQuantity
          );

          const top10 = grouped.sort((a, b) => b.total - a.total).slice(0, 10);
          const labels = top10.map(p => p.key.substring(0, 28) + (p.key.length > 28 ? '…' : ''));

          return this.chartGenerator.generateBarChart(
            labels, top10.map(p => p.total), chartLabel, true, undefined,
            { plugins: { customDataLabels: { format } } }
          );
        }

        case 'comparison': {
          const selected = state.comparisonAccounts;
          const data = this.salesProcessor.filteredData().filter(r => selected.includes(r.account || ''));
          const grouped = groupAndSum(data, r => r.account || 'Unknown', r => state.comparisonType === 'revenue' ? r.total : r.itemQuantity);

          return this.chartGenerator.generateBarChart(
            grouped.map(g => g.key), grouped.map(g => g.total),
            state.comparisonType === 'revenue' ? 'Revenue' : 'Units Sold', false, undefined,
            { plugins: { customDataLabels: { format: state.comparisonType === 'revenue' ? 'currency' : 'number' } } }
          );
        }
        case 'account': {
          const grouped = groupAndSum(state.allRowViews, r => r.account || 'Unknown', r => state.comparisonType === 'revenue' ? r.total : r.itemQuantity);
          const sorted = grouped.sort((a, b) => b.total - a.total);
          return this.chartGenerator.generateBarChart(
            sorted.map(g => g.key), sorted.map(g => g.total),
            state.comparisonType === 'revenue' ? 'Revenue' : 'Units Sold', false, undefined,
            { plugins: { customDataLabels: { format: state.comparisonType === 'revenue' ? 'currency' : 'number' } } }
          );
        }
        case 'category': {
          const grouped = groupAndSum(state.allRowViews, r => r.category || 'Unknown', r => state.comparisonType === 'revenue' ? r.total : r.itemQuantity);
          const sorted = grouped.sort((a, b) => b.total - a.total);
          return this.chartGenerator.generateDoughnutChart(
            sorted.map(g => g.key),
            sorted.map(g => g.total),
            { plugins: { customDataLabels: { format: state.comparisonType === 'revenue' ? 'currency' : 'number' } } }
          );
        }
        case 'type':
        case 'division':
        case 'collection':
        case 'brand': {
          const metric = state.comparisonType;
          const format = metric === 'revenue' ? 'currency' : 'number';

          if (state.preAggregatedProducts?.length) {
            const sorted = [...state.preAggregatedProducts].sort((a, b) =>
              metric === 'revenue' ? b.current - a.current : b.units - a.units
            );
            const top10 = sorted.slice(0, 10);
            return this.chartGenerator.generateDoughnutChart(
              top10.map(p => p.name),
              top10.map(p => metric === 'revenue' ? p.current : p.units),
              { plugins: { customDataLabels: { format } } }
            );
          }

          const grouped = groupAndSum(
            state.allRowViews,
            r => getProductGroupingKey(r, state.key, false),
            r => metric === 'revenue' ? r.total : r.itemQuantity
          );
          const sorted = grouped.sort((a, b) => b.total - a.total);
          return this.chartGenerator.generateDoughnutChart(
            sorted.map(g => g.key),
            sorted.map(g => g.total),
            { plugins: { customDataLabels: { format } } }
          );
        }
        case 'channel': {
          const d = this.salesProcessor.salesByChannel();
          return this.chartGenerator.generateDoughnutChart(d.map((c: { channel: string }) => c.channel), d.map((c: { total: number }) => c.total), { plugins: { customDataLabels: { format: 'currency' } } });
        }
        case 'yoy': {
          const comparisonData =
            state.yoyComparisonData ?? this.salesProcessor.salesByYearComparison();
          const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const selected =
            state.yoySelectedMonths?.length
              ? [...state.yoySelectedMonths].sort((a, b) => a - b)
              : allMonths.map((_, i) => i);

          const baseFull =
            (state.yoyMetric === 'revenue' ? comparisonData.revenue : comparisonData.units).get(state.yoyBaseYear) ||
            new Array(12).fill(0);
          const compFull =
            (state.yoyMetric === 'revenue' ? comparisonData.revenue : comparisonData.units).get(state.yoyCompYear) ||
            new Array(12).fill(0);

          const months = selected.map(i => allMonths[i]);
          const baseValues = selected.map(i => baseFull[i] ?? 0);
          const compValues = selected.map(i => compFull[i] ?? 0);

          return this.chartGenerator.generateLineChart(months, [
            {
              label: `${state.yoyBaseYear} (${state.yoyMetric === 'revenue' ? '$' : 'Units'})`,
              data: baseValues as number[],
              borderColor: GLOBAL_CHART_COLORS[0],
              backgroundColor: 'transparent',
              tension: 0.3,
              pointRadius: 4
            },
            {
              label: `${state.yoyCompYear} (${state.yoyMetric === 'revenue' ? '$' : 'Units'})`,
              data: compValues as number[],
              borderColor: GLOBAL_CHART_COLORS[1],
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 4
            }
          ], { plugins: { customDataLabels: { format: state.yoyMetric === 'revenue' ? 'currency' : 'number' } } });
        }
        default:
          return { type: 'line', data: {}, options: {} };
      }
    })();

    const options = (config.options ?? {}) as Record<string, unknown>;
    config.options = options;

    const textColor = state.darkText ? '#333333' : '#888888';
    options['color'] = textColor;

    if (config.type === 'bar' || config.type === 'line') {
      const scales = (options['scales'] ?? {}) as Record<string, Record<string, unknown>>;
      options['scales'] = scales;

      const x = (scales['x'] ?? {}) as Record<string, unknown>;
      scales['x'] = x;
      const xTicks = (x['ticks'] ?? {}) as Record<string, unknown>;
      x['ticks'] = xTicks;
      xTicks['color'] = textColor;

      const y = (scales['y'] ?? {}) as Record<string, unknown>;
      scales['y'] = y;
      const yTicks = (y['ticks'] ?? {}) as Record<string, unknown>;
      y['ticks'] = yTicks;
      yTicks['color'] = textColor;
    }

    const plugins = (options['plugins'] ?? {}) as Record<string, unknown>;
    options['plugins'] = plugins;
    const customDataLabels = (plugins['customDataLabels'] ?? {}) as Record<string, unknown>;
    plugins['customDataLabels'] = customDataLabels;
    customDataLabels['display'] = state.showDataLabels;
    customDataLabels['color'] = '#000000';

    return config as ChartJsConfig;
  }

  aggregateTopProductsTable(
    current: ISaleRecordView[],
    ly: ISaleRecordView[],
    useStyleName: boolean,
    topCount: number | 'all',
    grouping: string = 'parent',
    metric: 'revenue' | 'units' = 'revenue'
  ): TopProductsTableData[] {
    const valueFn = (r: ISaleRecordView) => (metric === 'revenue' ? r.total : r.itemQuantity);

    const data = comparePeriods(
      current, ly,
      r => getProductGroupingKey(r, grouping, useStyleName),
      valueFn
    );

    const unitsMap = new Map<string, number>();
    current.forEach(r => {
      const k = getProductGroupingKey(r, grouping, useStyleName);
      unitsMap.set(k, (unitsMap.get(k) || 0) + r.itemQuantity);
    });

    const revenueMap = new Map<string, number>();
    current.forEach(r => {
      const k = getProductGroupingKey(r, grouping, useStyleName);
      revenueMap.set(k, (revenueMap.get(k) || 0) + r.total);
    });

    let finalData = data.map(item => ({
      ...item,
      units: unitsMap.get(item.name) || 0,
      revenue: revenueMap.get(item.name) || 0,
    })) as TopProductsTableData[];

    finalData.sort((a, b) =>
      metric === 'revenue' ? b.current - a.current : (b.units ?? 0) - (a.units ?? 0)
    );

    if (topCount !== 'all') {
      return finalData.slice(0, topCount);
    }

    return finalData;
  }
}
