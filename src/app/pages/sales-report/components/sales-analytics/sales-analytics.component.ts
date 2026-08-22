import { Component, computed, inject, signal, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartComponent } from '@shared/components/chart/chart.component';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { MainTableFilterComponent } from '@shared/main-table-filter/main-table-filter.component';

import { SalesChartBuilderService, ChartBuilderState, TopProductsTableData } from '@core/services/Excel/sales-chart-builder.service';
import { CHART_CONFIGS } from '@core/data/sales-report.constants';
import { ChartKey } from '@core/interfaces/chart.interface';
import { ISaleRecordView } from '@core/interfaces/ISaleRecordDto.interface';
import { comparePeriods } from '@core/auxiliar/data-aggregation.helper';
import { getProductGroupingKey } from '@core/auxiliar/chart-keys.helper';
import { parseSkuParts } from '@core/auxiliar/sku.utils';
import { DateUtils } from '@core/auxiliar/date.utils';
import { ChannelDisplayPipe } from '@core/pipes/channel-display.pipe';
import { AlertService } from '@core/services/Utils/alert.service';

import { PivotTableComponent } from '@shared/components/pivot-table/pivot-table.component';
import { KpiGridComponent } from '@shared/components/kpi-grid/kpi-grid.component';
import { ChartPanelComponent } from '@shared/components/chart-panel/chart-panel.component';
import { PivotRow, PivotYearData } from '@core/interfaces/pivot.interface';
import { PIVOT_MONTHS } from '@core/constants/pivot.constants';
import { buildYoyPivotData } from '@core/auxiliar/yoy-pivot.helper';
import {
  filterPriorYearRowsForScope,
  filterRecordsForYoyAnalysis,
  formatYoyPeriodLabel,
  formatYtdComparisonPeriodLabel,
} from '@core/auxiliar/sales-yoy.util';

export type TopProductsView = 'products' | 'type' | 'collection' | 'division';

@Component({
  selector: 'app-sales-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent, DataTableComponent, MainTableFilterComponent, ChannelDisplayPipe, PivotTableComponent, KpiGridComponent, ChartPanelComponent],
  templateUrl: './sales-analytics.component.html',
  styleUrl: './sales-analytics.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesAnalyticsComponent {
  chartBuilderService = inject(SalesChartBuilderService);
  private alertService = inject(AlertService);

  // Data inputs from parent
  filteredData = input<any[]>([]);
  salesData = input<any[]>([]);
  referenceData = input<any[]>([]);
  salesFilters = input<any>({});

  totalRevenue = input<number>(0);
  revenueTrend = input<{ value: number; percentage: number; isPositive: boolean; currentYear?: number; currentMonth?: number; compareYear?: number; currentTotal?: number; compareTotal?: number; status?: string; statusMessage?: string | null }>({ value: 0, percentage: 0, isPositive: true });
  unitsTrend = input<{ value: number; percentage: number; isPositive: boolean; currentYear?: number; currentMonth?: number; compareYear?: number; currentTotal?: number; compareTotal?: number; status?: string; statusMessage?: string | null }>({ value: 0, percentage: 0, isPositive: true });
  yearRevenueComparison = input<{
    percentage: number;
    isPositive: boolean;
    currentYear: number;
    currentMonth?: number;
    compareYear: number;
    currentTotal: number;
    compareTotal: number;
    scopeLabel: string;
    status?: string;
    statusMessage?: string | null;
  }>({
    percentage: 0,
    isPositive: true,
    currentYear: 0,
    compareYear: 0,
    currentTotal: 0,
    compareTotal: 0,
    scopeLabel: 'REVENUE',
  });
  yearUnitsComparison = input<{
    percentage: number;
    isPositive: boolean;
    currentYear: number;
    currentMonth?: number;
    compareYear: number;
    currentTotal: number;
    compareTotal: number;
    scopeLabel: string;
    status?: string;
    statusMessage?: string | null;
  }>({
    percentage: 0,
    isPositive: true,
    currentYear: 0,
    compareYear: 0,
    currentTotal: 0,
    compareTotal: 0,
    scopeLabel: 'UNITS',
  });

  availableAccounts = input<string[]>([]);
  accountFilter = input<string[]>([]);
  accountFilterChange = output<string[]>();
  searchFilter = input<string>('');
  searchFilterChange = output<string>();
  startDate = input<string>('');
  startDateChange = output<string>();
  endDate = input<string>('');
  endDateChange = output<string>();
  clearFiltersRequest = output<void>();

  showStyleName = input<boolean>(false);
  toggleStyleName = output<boolean>();

  selectedMonths = input<number[]>([]);
  selectedMonthsChange = output<number[]>();
  isLoading = input(false);

  readonly chartConfigs = CHART_CONFIGS;
  activeChart = signal<ChartKey>('yoy');
  activeSubChart = signal<'default' | 'account' | 'category' | 'type' | 'division' | 'collection'>('default');
  yoyBaseYear = signal<number>(DateUtils.now().getFullYear());
  yoyCompYear = signal<number>(DateUtils.now().getFullYear() - 1);
  salesMetric = signal<'revenue' | 'units'>('revenue');

  /** @deprecated Use {@link salesMetric} — kept for template compatibility. */
  yoyMetric = this.salesMetric;
  /** @deprecated Use {@link salesMetric} — kept for template compatibility. */
  comparisonType = this.salesMetric;

  setSalesMetric(metric: 'revenue' | 'units'): void {
    this.salesMetric.set(metric);
  }

  showVisualChart = signal<boolean>(true);
  compareWithLastYear = signal<boolean>(false);
  showMoreFilters = signal<boolean>(false);
  kpisCollapsed = signal<boolean>(false);

  toggleKpisCollapsed(): void {
    this.kpisCollapsed.update(v => !v);
  }

  // Pivot Table Controls
  pivotShowPercentages = signal<boolean>(false);
  pivotShowTrend = signal<boolean>(false);
  pivotShowTotal = signal<boolean>(true);
  pivotSelectedAccounts = signal<string[]>([]);
  pivotSelectedCategories = signal<string[]>([]); // Will store ['Retail', 'Wholesale']
  collapsedYears = signal<Set<number>>(new Set());

  // Advanced Product Filters
  selectedYears = signal<number[]>([]);
  selectedProducts = signal<string[]>([]);
  productMonthsFilter = signal<number[]>([]);
  selectedTypes = signal<string[]>([]);
  selectedDivisions = signal<string[]>([]);
  selectedCollections = signal<string[]>([]);
  topProductsCount = signal<number | 'all'>(5);
  hideUnknownCategory = signal<boolean>(false);
  topProductsView = signal<TopProductsView>('products');

  readonly TOP_PRODUCTS_VIEW_OPTIONS: { key: TopProductsView; label: string }[] = [
    { key: 'products', label: 'Top Products' },
    { key: 'type', label: 'Top Type' },
    { key: 'collection', label: 'Top Collection' },
    { key: 'division', label: 'Top Division' },
  ];

  readonly tableDefaultSortKey = 'current';

  toggleYear(year: number) {
    const current = new Set(this.collapsedYears());
    if (current.has(year)) current.delete(year);
    else current.add(year);
    this.collapsedYears.set(current);
  }

  showPivotMonthMenu = signal<boolean>(false);
  showPivotAccountMenu = signal<boolean>(false);
  showPivotCategoryMenu = signal<boolean>(false);

  showYearFilterMenu = signal<boolean>(false);
  showProductFilterMenu = signal<boolean>(false);
  showTopCountMenu = signal<boolean>(false);
  showTopViewMenu = signal<boolean>(false);
  showProductMonthMenu = signal<boolean>(false);
  showTypeFilterMenu = signal<boolean>(false);
  showDivisionFilterMenu = signal<boolean>(false);
  showCollectionFilterMenu = signal<boolean>(false);

  readonly PIVOT_MONTHS = PIVOT_MONTHS;
  readonly PIVOT_CATEGORIES: Record<string, string[]> = {
    Retail: ['Amazon Dropship', 'Amazon RP', 'Retail', 'RFM'],
    Wholesale: ['FG', 'Faire', 'WHOLESALES']
  };

  hasData = computed(() => this.salesData().length > 0);
  activeChartLabel = computed(() => {
    if (this.activeChart() === 'products') {
      const opt = this.TOP_PRODUCTS_VIEW_OPTIONS.find(o => o.key === this.topProductsView());
      return opt?.label ?? 'Top Products';
    }
    if (this.activeSubChart() === 'account') return 'Sales by Account';
    if (this.activeSubChart() === 'category') return 'Sales by Category';
    if (this.activeSubChart() === 'type') return 'Sales by Type';
    if (this.activeSubChart() === 'division') return 'Sales by Division';
    if (this.activeSubChart() === 'collection') return 'Sales by Collection';
    return this.chartConfigs.find(c => c.key === this.activeChart())?.label ?? '';
  });

  /** YoY dataset: filtered scope + prior-year same audit months (ignores date filter on LY). */
  yoyAnalysisRows = computed(() => {
    let data = filterRecordsForYoyAnalysis(this.salesData(), this.salesFilters());

    const selAcc = this.pivotSelectedAccounts();
    const selCat = this.pivotSelectedCategories();

    if (selAcc.length > 0) {
      const accSet = new Set(selAcc);
      data = data.filter(r => accSet.has(r.account));
    }

    if (selCat.length > 0) {
      const allowed = new Set<string>();
      selCat.forEach(cat => this.PIVOT_CATEGORIES[cat]?.forEach(acc => allowed.add(acc)));
      data = data.filter(r => allowed.has(r.account));
    }

    return data as ISaleRecordView[];
  });

  activeTrendSummary = computed(() =>
    this.salesMetric() === 'units' ? this.unitsTrend() : this.revenueTrend()
  );

  activeYearComparison = computed(() => {
    const raw = this.salesMetric() === 'units' ? this.yearUnitsComparison() : this.yearRevenueComparison();
    return {
      ...raw,
      currentRevenue: raw.currentTotal,
      compareRevenue: raw.compareTotal,
    };
  });

  activeKpiStatusMessage = computed(() => {
    const trendMsg = this.activeTrendSummary().statusMessage;
    const yearMsg = this.activeYearComparison().statusMessage;
    if (trendMsg && yearMsg && trendMsg === yearMsg) return trendMsg;
    return trendMsg ?? yearMsg ?? null;
  });

  pivotAvailableAccounts = computed<string[]>(() => {
    return [...new Set(this.yoyAnalysisRows().map(r => r.account).filter(Boolean))].sort();
  });

  /** Rows after global filters + local pivot filters (no styleName clone). */
  pivotFilteredRows = computed(() => {
    let data = this.filteredData();
    if (!data.length) return [] as ISaleRecordView[];

    const selAcc = this.pivotSelectedAccounts();
    const selCat = this.pivotSelectedCategories();

    if (selAcc.length > 0) {
      const accSet = new Set(selAcc);
      data = data.filter(r => accSet.has(r.account));
    }

    if (selCat.length > 0) {
      const allowed = new Set<string>();
      selCat.forEach(cat => this.PIVOT_CATEGORIES[cat]?.forEach(acc => allowed.add(acc)));
      data = data.filter(r => allowed.has(r.account));
    }

    return data as ISaleRecordView[];
  });

  referenceByParent = computed(() => {
    const refData = this.referenceData();
    return new Map(refData.map(item => [item.parent.toLowerCase(), item]));
  });

  styleNameByParent = computed(() => {
    const refData = this.referenceData();
    return new Map(refData.map(item => [item.parent.toLowerCase(), item.styleName]));
  });

  /** Parents present in the current pivot scope for attribute filters. */
  private scopedParentKeys = computed(() => {
    const keys = new Set<string>();
    this.pivotFilteredRows().forEach(r => {
      keys.add(parseSkuParts(r.sku).parent.toLowerCase());
    });
    return keys;
  });

  availableTypes = computed(() => {
    const parents = this.scopedParentKeys();
    return [...new Set(
      this.referenceData()
        .filter(r => parents.has(r.parent.toLowerCase()))
        .map(r => r.type)
        .filter(Boolean)
    )].sort();
  });

  availableDivisions = computed(() => {
    const parents = this.scopedParentKeys();
    return [...new Set(
      this.referenceData()
        .filter(r => parents.has(r.parent.toLowerCase()))
        .map(r => r.div)
        .filter(Boolean)
    )].sort();
  });

  availableCollections = computed(() => {
    const parents = this.scopedParentKeys();
    return [...new Set(
      this.referenceData()
        .filter(r => parents.has(r.parent.toLowerCase()))
        .map(r => r.collection)
        .filter(Boolean)
    )].sort();
  });

  activeTopProductsViewLabel = computed(() =>
    this.TOP_PRODUCTS_VIEW_OPTIONS.find(o => o.key === this.topProductsView())?.label ?? 'Top Products'
  );

  yoyChartHeight = computed(() => {
    const count = Math.max(1, this.selectedMonths().length || 12);
    const ratio = count / 12;
    const minRem = 10;
    const maxRem = 22;
    return `${(minRem + (maxRem - minRem) * ratio).toFixed(2)}rem`;
  });

  lastYearRows = computed(() => {
    if (this.activeChart() !== 'products') return [];

    const currentFiltered = this.filteredData();
    if (!currentFiltered.length) return [];

    let lyData = filterPriorYearRowsForScope(this.salesData(), this.salesFilters());

    const selAcc = this.pivotSelectedAccounts();
    const selCat = this.pivotSelectedCategories();

    if (selAcc.length > 0) {
      const accSet = new Set(selAcc);
      lyData = lyData.filter(r => accSet.has(r.account));
    }

    if (selCat.length > 0) {
      const allowed = new Set<string>();
      selCat.forEach(cat => this.PIVOT_CATEGORIES[cat]?.forEach(acc => allowed.add(acc)));
      lyData = lyData.filter(r => allowed.has(r.account));
    }

    return lyData;
  });

  yoyPivotData = computed(() => {
    const metric = this.salesMetric();
    return buildYoyPivotData({
      records: this.yoyAnalysisRows(),
      getYear: r => {
        const y = Number(r.auditYear);
        return Number.isNaN(y) ? null : y;
      },
      getMonth: r => {
        const m = Number(r.auditMonth) - 1;
        return Number.isNaN(m) || m < 0 || m > 11 ? null : m;
      },
      getLabel: r => r.account || 'Unknown',
      getValue: r => (metric === 'revenue' ? r.total : r.itemQuantity),
      selectedMonthIndices: this.selectedMonths(),
    });
  });

  yoyComparisonFromPivot = computed(() => {
    const years = new Map<number, number[]>();
    const yearsUnits = new Map<number, number[]>();

    this.yoyAnalysisRows().forEach(r => {
      const year = Number(r.auditYear);
      const month = Number(r.auditMonth) - 1;
      if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return;

      if (!years.has(year)) {
        years.set(year, new Array(12).fill(0));
        yearsUnits.set(year, new Array(12).fill(0));
      }
      years.get(year)![month] += r.total;
      yearsUnits.get(year)![month] += r.itemQuantity;
    });

    return { revenue: years, units: yearsUnits };
  });

  yoyChartYears = computed(() => {
    const years = this.yoyPivotData().map(y => y.year).sort((a, b) => b - a);
    return {
      base: years[0] ?? this.yoyBaseYear(),
      compare: years[1] ?? this.yoyCompYear(),
    };
  });

  yoyGrandTotals = computed(() => {
    const data = this.yoyPivotData();
    const selectedMonths = this.selectedMonths();
    const monthsTotal = new Array(12).fill(0);
    let grandTotal = 0;

    for (const y of data) {
      for (let i = 0; i < 12; i++) {
        if (selectedMonths.includes(i)) {
          monthsTotal[i] += y.monthsTotal[i];
        }
      }
      grandTotal += y.yearTotal;
    }
    return { monthsTotal, grandTotal };
  });

  getTrendForYear(index: number) {
    const data = this.yoyPivotData();
    if (index >= data.length - 1) return null;
    
    const current = data[index].monthsTotal;
    const previous = data[index + 1].monthsTotal;
    
    const trendMonths = current.map((val, i) => {
      const prevVal = previous[i];
      if (prevVal === 0) return val > 0 ? 100 : 0;
      return ((val - prevVal) / prevVal) * 100;
    });

    const currentTotal = data[index].yearTotal;
    const previousTotal = data[index + 1].yearTotal;
    const totalTrend = previousTotal === 0 ? (currentTotal > 0 ? 100 : 0) : ((currentTotal - previousTotal) / previousTotal) * 100;

    return { months: trendMonths, total: totalTrend };
  }

  availableYears = computed(() => {
    const data = this.salesData();
    if (!data.length) return [];
    // Mapeo directo y seguro de los años disponibles desde la propiedad auditYear
    return [...new Set(data.map(r => Number(r.auditYear)).filter(y => !isNaN(y) && y > 1900))].sort((a, b) => b - a);
  });

  availableProducts = computed(() => {
    if (this.activeChart() !== 'products') return [];

    let data = this.pivotFilteredRows();
    const selYears = this.selectedYears();
    const hideUnknown = this.hideUnknownCategory();
    if (selYears.length > 0) {
      data = data.filter(r => r.auditYear && selYears.includes(Number(r.auditYear)));
    }
    if (hideUnknown) {
      data = data.filter(r => r.category && r.category.toLowerCase() !== 'unknown');
    }
    if (!data.length) return [];

    const refData = this.referenceData();
    const products = new Set<string>();
    data.forEach(r => {
      products.add(getProductGroupingKey(r, 'parent', refData, this.showStyleName()));
    });
    return Array.from(products).sort();
  });

  productGroupingKey = computed(() => {
    const view = this.topProductsView();
    if (view === 'products') return 'parent';
    return view;
  });

  /** Shared row set for Top Products table and chart (local + pivot filters). */
  productsScopedViews = computed(() => {
    let views = this.pivotFilteredRows();
    const selYears = this.selectedYears();
    const selMonths = this.productMonthsFilter();
    const hideUnknown = this.hideUnknownCategory();
    const selProds = this.selectedProducts();
    const selTypes = this.selectedTypes();
    const selDivs = this.selectedDivisions();
    const selColls = this.selectedCollections();
    const refByParent = this.referenceByParent();

    if (selYears.length > 0) {
      views = views.filter(r => r.auditYear && selYears.includes(Number(r.auditYear)));
    }
    if (selMonths.length > 0) {
      views = views.filter(r => {
        const m = Number(r.auditMonth) - 1;
        return !isNaN(m) && selMonths.includes(m);
      });
    }
    if (hideUnknown) {
      views = views.filter(r => r.category && r.category.toLowerCase() !== 'unknown');
    }
    if (selTypes.length > 0 || selDivs.length > 0 || selColls.length > 0) {
      views = views.filter(r => {
        const ref = refByParent.get(parseSkuParts(r.sku).parent.toLowerCase());
        if (!ref) return false;
        if (selTypes.length > 0 && !selTypes.includes(ref.type)) return false;
        if (selDivs.length > 0 && !selDivs.includes(ref.div)) return false;
        if (selColls.length > 0 && !selColls.includes(ref.collection)) return false;
        return true;
      });
    }
    if (selProds.length > 0) {
      const refData = this.referenceData();
      const grouping = this.productGroupingKey();
      const prodSet = new Set(selProds);
      views = views.filter(r =>
        prodSet.has(getProductGroupingKey(r, grouping, refData, this.showStyleName()))
      );
    }
    return views;
  });

  /** Single aggregation pipeline for Top Products table and chart. */
  productsAggregatedData = computed(() => {
    if (this.activeChart() !== 'products') return [];

    const current = this.productsScopedViews();
    if (!current.length) return [];

    const ly = this.compareWithLastYear() ? this.lastYearRows() : [];
    const metric = this.salesMetric();
    let data = this.chartBuilderService.aggregateTopProductsTable(
      current,
      ly,
      this.showStyleName(),
      'all',
      this.productGroupingKey(),
      metric
    );

    const totalUnits = data.reduce((acc, item) => acc + item.units, 0);
    const totalRevenue = data.reduce((acc, item) => acc + (item.revenue ?? item.current), 0);
    const totalPrimary = metric === 'revenue' ? totalRevenue : totalUnits;

    if (this.pivotShowPercentages()) {
      data = data.map(item => ({
        ...item,
        pctUnits: totalUnits > 0 ? Number(((item.units / totalUnits) * 100).toFixed(1)) : 0,
        pctRevenue: totalRevenue > 0 ? Number((((item.revenue ?? item.current) / totalRevenue) * 100).toFixed(1)) : 0,
        pct: totalPrimary > 0 ? Number(((item.current / totalPrimary) * 100).toFixed(1)) : 0,
      }));
    }

    return data;
  });

  aggregatedTableData = computed(() => {
    if (this.activeChart() !== 'products') return [];

    const topCount = this.topProductsCount();
    const data = this.productsAggregatedData();
    return topCount === 'all' ? data : data.slice(0, topCount);
  });

  tableFooterData = computed(() => {
    if (this.activeChart() !== 'products') return null;

    const current = this.productsScopedViews();
    if (!current.length) return null;

    const metric = this.salesMetric();
    const totalUnits = current.reduce((acc, r) => acc + r.itemQuantity, 0);
    const totalRevenue = current.reduce((acc, r) => acc + r.total, 0);

    return {
      name: 'TOTAL',
      current: metric === 'revenue' ? totalRevenue : totalUnits,
      units: totalUnits,
      revenue: totalRevenue,
      ly: 0,
      diff: 0,
      pct: 0,
      pctUnits: 100,
      pctRevenue: 100
    };
  });

  topProductsPivotData = computed<PivotYearData[]>(() => {
    if (this.activeChart() !== 'products') return [];

    const views = this.productsScopedViews();
    const metric = this.salesMetric();
    const refData = this.referenceData();
    const grouping = this.productGroupingKey();
    const yearsMap = new Map<number, Map<string, number[]>>();

    views.forEach(v => {
      const year = Number(v.auditYear);
      const month = Number(v.auditMonth) - 1;
      if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return;

      const label = getProductGroupingKey(v, grouping, refData, this.showStyleName());
      const val = metric === 'revenue' ? v.total : v.itemQuantity;

      if (!yearsMap.has(year)) yearsMap.set(year, new Map());
      const accMap = yearsMap.get(year)!;
      if (!accMap.has(label)) accMap.set(label, new Array(12).fill(0));
      accMap.get(label)![month] += val;
    });

    return Array.from(yearsMap.keys()).sort((a, b) => b - a).map(year => {
      const accMap = yearsMap.get(year)!;
      const rows: PivotRow[] = Array.from(accMap.entries()).map(([label, months]) => ({
        label,
        months,
        total: months.reduce((a, b) => a + b, 0)
      })).sort((a, b) => b.total - a.total);

      const monthsTotal = new Array(12).fill(0);
      rows.forEach(r => r.months.forEach((v, i) => monthsTotal[i] += v));

      return {
        year,
        rows,
        monthsTotal,
        yearTotal: monthsTotal.reduce((a, b) => a + b, 0)
      };
    });
  });

  tableFooterPivotData = computed(() => {
    const data = this.topProductsPivotData();
    if (!data.length) return null;

    const monthsTotal = new Array(12).fill(0);
    let grandTotal = 0;
    data.forEach(y => {
      y.monthsTotal.forEach((v, i) => monthsTotal[i] += v);
      grandTotal += y.yearTotal;
    });
    return { monthsTotal, grandTotal };
  });

  kpiPeriodSummary = computed(() => {
    const data = this.filteredData();
    if (!data.length) return 'No records match the current filters';

    const periods = new Map<string, { year: number; month: number }>();
    data.forEach(r => {
      const year = Number(r.auditYear);
      const month = Number(r.auditMonth);
      if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
        periods.set(`${year}-${month}`, { year, month });
      }
    });

    const sorted = Array.from(periods.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
    if (!sorted.length) return 'Filtered sales records';

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const fmt = (p: { year: number; month: number }) =>
      `${this.PIVOT_MONTHS[p.month - 1]?.label ?? p.month} ${p.year}`;

    if (first.year === last.year && first.month === last.month) {
      return fmt(first);
    }
    return `${fmt(first)} – ${fmt(last)}`;
  });

  revenueTrendPeriodLabel = computed(() => {
    const trend = this.activeTrendSummary();
    if (trend.currentYear && trend.currentMonth && trend.compareYear) {
      return formatYoyPeriodLabel({
        currentYear: trend.currentYear,
        currentMonth: trend.currentMonth,
        compareYear: trend.compareYear,
        value: 0,
        percentage: 0,
        isPositive: true,
        currentTotal: 0,
        compareTotal: 0,
        status: 'complete',
        statusMessage: null,
      });
    }
    return this.kpiPeriodSummary();
  });

  unitsSoldPeriodLabel = computed(() => {
    const cmp = this.activeYearComparison();
    if (cmp.currentYear && cmp.compareYear) {
      return formatYtdComparisonPeriodLabel(
        cmp.currentYear,
        cmp.compareYear,
        cmp.currentMonth ?? 0
      );
    }
    return this.kpiPeriodSummary();
  });

  isProductTableClickable = computed(
    () => this.activeChart() === 'products' && this.topProductsView() === 'products'
  );

  analyticalColumns = computed<TableColumn[]>(() => {
    const chart = this.activeChart();
    const compare = this.compareWithLastYear();
    const isUnitsCompare = this.salesMetric() === 'units';

    const years = [...new Set(this.productsScopedViews().map(r => Number(r.auditYear)).filter(y => !isNaN(y)))];
    const yearLabel = years.length === 1 ? ` (${years[0]})` : '';

    const dimensionLabels: Record<TopProductsView, string> = {
      products: 'Product',
      type: 'Type',
      collection: 'Collection',
      division: 'Division',
    };
    const dimensionLabel = dimensionLabels[this.topProductsView()];

    const cols: TableColumn[] = [
      { key: 'name', label: dimensionLabel, cssClass: 'font-semibold mono', sortable: true },
      {
        key: 'current',
        label: isUnitsCompare ? `Units${yearLabel}` : `Sales${yearLabel}`,
        type: isUnitsCompare ? 'number' : 'currency',
        sortable: true
      }
    ];

    if (chart === 'products' && !isUnitsCompare) {
      if (this.pivotShowPercentages()) {
        cols.push({ key: 'pct', label: '% of Total', type: 'percent', sortable: true });
      }
      cols.push({ key: 'units', label: 'Units Sold', type: 'number', sortable: true });
      if (this.pivotShowPercentages()) {
        cols.push({ key: 'pctUnits', label: '% Units', type: 'percent', sortable: true });
      }
    }

    if (chart === 'products' && isUnitsCompare) {
      if (this.pivotShowPercentages()) {
        cols.push({ key: 'pct', label: '% of Total', type: 'percent', sortable: true });
      }
      cols.push({ key: 'revenue', label: 'Revenue', type: 'currency', sortable: true });
    }

    if (compare) {
      cols.push(
        { key: 'ly', label: 'Last Year (LY)', type: isUnitsCompare ? 'number' : 'currency', sortable: true },
        { key: 'diff', label: 'YoY Growth', type: isUnitsCompare ? 'number' : 'currency', sortable: true },
        { key: 'pct', label: 'YoY Trend (%)', type: 'percent', sortable: true }
      );
    }
    return cols;
  });

  chartConfig = computed(() => {
    let views = this.pivotFilteredRows();
    let key = this.activeChart();
    let preAggregated: TopProductsTableData[] | undefined;
    const yoySelectedMonths =
      this.activeChart() === 'yoy' ? [...this.selectedMonths()].sort((a, b) => a - b) : undefined;
    const yoyYears = this.activeChart() === 'yoy' ? this.yoyChartYears() : null;

    if (this.activeChart() === 'products') {
      views = this.productsScopedViews();
      const sub = this.activeSubChart();
      const dimensionKeys: TopProductsView[] = ['products', 'type', 'collection', 'division'];

      if (sub === 'default' || dimensionKeys.includes(sub as TopProductsView)) {
        const dim = this.topProductsView();
        key = dim === 'products' ? 'products' : (dim as ChartKey);
        preAggregated = this.productsAggregatedData();
      } else {
        key = sub as ChartKey;
      }
    } else if (this.activeSubChart() !== 'default') {
      key = this.activeSubChart() as ChartKey;
    }

    const state: ChartBuilderState = {
      key,
      granularity: 'week',
      hasData: this.hasData(),
      productGrouping:
        this.activeChart() === 'products'
          ? 'parent'
          : this.showStyleName()
            ? 'parent'
            : 'sku',
      comparisonAccounts: [],
      comparisonType: this.salesMetric(),
      allRowViews: views,
      yoyBaseYear: yoyYears?.base ?? this.yoyBaseYear(),
      yoyCompYear: yoyYears?.compare ?? this.yoyCompYear(),
      yoyMetric: this.salesMetric(),
      showStyleName: this.showStyleName(),
      hideSmallData: false,
      darkText: false,
      showDataLabels: true,
      preAggregatedProducts: preAggregated,
      yoySelectedMonths,
      yoyComparisonData: this.activeChart() === 'yoy' ? this.yoyComparisonFromPivot() : undefined,
    };
    return this.chartBuilderService.buildChart(state);
  });

  setActiveChart(key: ChartKey) {
    this.activeChart.set(key);
    this.activeSubChart.set('default');
    this.showMoreFilters.set(false);
    if (key === 'products') {
      this.topProductsView.set('products');
    }
  }

  setTopProductsView(view: TopProductsView) {
    this.topProductsView.set(view);
    this.activeSubChart.set(view === 'products' ? 'default' : view);
    this.showTopViewMenu.set(false);
  }

  setActiveSubChart(sub: 'default' | 'account' | 'category' | 'type' | 'division' | 'collection') {
    this.activeSubChart.set(sub);
    if (this.activeChart() !== 'products') return;
    if (sub === 'default') {
      this.topProductsView.set('products');
    } else if (sub === 'type' || sub === 'collection' || sub === 'division') {
      this.topProductsView.set(sub);
    }
  }

  showRevenueTrendInfo(): void {
    const trend = this.activeTrendSummary();
    const period = this.revenueTrendPeriodLabel();
    const filters = this.kpiPeriodSummary();
    const metricLabel = this.salesMetric() === 'units' ? 'Units' : 'Revenue';
    const formattedValue =
      this.salesMetric() === 'units'
        ? `${trend.value >= 0 ? '+' : ''}${Math.round(trend.value).toLocaleString()} units`
        : `${trend.value >= 0 ? '+' : ''}${trend.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
    this.alertService.info(
      `${metricLabel} Trend (YoY)`,
      `Compares ${metricLabel.toLowerCase()} for the same calendar month year-over-year (${period}). ` +
        `Change: ${formattedValue} ` +
        `(${trend.isPositive ? '▲' : '▼'} ${trend.percentage.toFixed(1)}%). ` +
        (trend.statusMessage ? `${trend.statusMessage} ` : '') +
        `Active filter period: ${filters}. ` +
        `Prior-year rows are loaded even when the date filter targets the current year only.`
    );
  }

  showYearRevenueComparisonInfo(): void {
    const cmp = this.activeYearComparison();
    const period = this.unitsSoldPeriodLabel();
    const metricLabel = this.salesMetric() === 'units' ? 'Units' : 'Revenue';
    const formatVal = (n: number) =>
      this.salesMetric() === 'units'
        ? n.toLocaleString('en-US')
        : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    this.alertService.info(
      `Year ${metricLabel} Comparison`,
      `${cmp.scopeLabel} ${cmp.currentYear}: ${formatVal(cmp.currentRevenue)} ` +
        `(${cmp.isPositive ? '▲' : '▼'} ${cmp.percentage.toFixed(1)}% vs ${cmp.compareYear}). ` +
        `${cmp.scopeLabel} ${cmp.compareYear}: ${formatVal(cmp.compareRevenue)}. ` +
        (cmp.statusMessage ? `${cmp.statusMessage} ` : '') +
        `Period: ${period}. Compares year-to-date totals (Jan through the latest audit month) vs the same months in the prior year.`
    );
  }

  onProductRowClick(row: TopProductsTableData): void {
    if (!this.isProductTableClickable()) return;

    const refData = this.referenceData();
    const rows = this.productsScopedViews().filter(
      r => getProductGroupingKey(r, 'parent', refData, this.showStyleName()) === row.name
    );
    if (!rows.length) {
      this.alertService.info(row.name, 'No unit breakdown available for this product.');
      return;
    }

    const byColor = new Map<string, number>();
    const bySize = new Map<string, number>();
    const bySizeColor = new Map<string, number>();

    rows.forEach(r => {
      const { color, size } = parseSkuParts(r.sku);
      byColor.set(color, (byColor.get(color) ?? 0) + r.itemQuantity);
      bySize.set(size, (bySize.get(size) ?? 0) + r.itemQuantity);
      const scKey = `${size} / ${color}`;
      bySizeColor.set(scKey, (bySizeColor.get(scKey) ?? 0) + r.itemQuantity);
    });

    const toSortedList = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([label, units]) => ({ label, units }))
        .sort((a, b) => b.units - a.units);

    this.alertService.productUnitsBreakdown(
      row.name,
      toSortedList(byColor),
      toSortedList(bySize),
      toSortedList(bySizeColor)
    );
  }

  onGlobalAccountChange(accounts: string[]): void {
    this.accountFilterChange.emit(accounts);
  }

  onGlobalSearchChange(value: string): void {
    this.searchFilterChange.emit(value);
  }

  onGlobalStartDateChange(value: string): void {
    this.startDateChange.emit(value);
  }

  onGlobalEndDateChange(value: string): void {
    this.endDateChange.emit(value);
  }

  onGlobalClearFilters(): void {
    this.clearFiltersRequest.emit();
  }

  toggleProductMonth(month: number): void {
    this.productMonthsFilter.update(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a, b) => a - b)
    );
  }

  toggleAllProductMonths(): void {
    if (this.productMonthsFilter().length === 12) {
      this.productMonthsFilter.set([]);
    } else {
      this.productMonthsFilter.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  }

  toggleAttributeFilter(kind: 'type' | 'division' | 'collection', value: string): void {
    const updater = (prev: string[]) =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value];
    if (kind === 'type') this.selectedTypes.update(updater);
    if (kind === 'division') this.selectedDivisions.update(updater);
    if (kind === 'collection') this.selectedCollections.update(updater);
  }

  togglePivotMonth(month: number) {
    const current = this.selectedMonths();
    const updated = current.includes(month) 
      ? current.filter(m => m !== month).sort((a, b) => a - b) 
      : [...current, month].sort((a, b) => a - b);
    this.selectedMonthsChange.emit(updated);
  }

  toggleAllMonths() {
    if (this.selectedMonths().length === 12) {
      this.selectedMonthsChange.emit([]);
    } else {
      this.selectedMonthsChange.emit([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  }

  toggleYearFilter(year: number) {
    this.selectedYears.update(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  }

  toggleProductFilter(prod: string) {
    this.selectedProducts.update(prev =>
      prev.includes(prod) ? prev.filter(p => p !== prod) : [...prev, prod]
    );
  }

  toggleAllProducts() {
    if (this.selectedProducts().length === this.availableProducts().length) {
      this.selectedProducts.set([]);
    } else {
      this.selectedProducts.set([...this.availableProducts()]);
    }
  }

  togglePivotAccount(account: string) {
    this.pivotSelectedAccounts.update(prev =>
      prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]
    );
  }

  togglePivotCategory(cat: string) {
    this.pivotSelectedCategories.update(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  toggleCategoryGroup(groupName: string) {
    this.togglePivotCategory(groupName);
  }
}
