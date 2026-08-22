import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartComponent } from '@shared/components/chart/chart.component';
import { ChartPanelComponent } from '@shared/components/chart-panel/chart-panel.component';
import { ChartGeneratorService } from '@core/services/Utils/chart-generator.service';
import { ChartConfig } from '@core/interfaces/chart.interface';
import {buildYoyPivotData} from '@core/auxiliar/yoy-pivot.helper';
import {resolveControlCategory} from '@core/data/control-channel-mapsheet';
import {mapCreditCardChannel} from '@core/pipes/credit-card-channel-display.pipe';
import {getCreditCardMonth, getCreditCardYear} from '@core/auxiliar/credit-card-date.util';
import {buildCreditCardSpendPivot} from '@core/auxiliar/credit-card-pivot.helper';
import {
  computeLastMonthSpendKpi,
  computeMonthSpendTrendKpi,
  computeYearSpendComparison,
  formatSpendTrendPeriodLabel,
  formatYearSpendPeriodLabel,
  resolveCreditCardFocusYear,
  CreditCardKpiSummary,
  CreditCardLastMonthSummary,
  CreditCardYearComparison,
} from '@core/auxiliar/credit-card-kpi.util';
import {CreditCardPivotTableComponent} from '../credit-card-pivot-table/credit-card-pivot-table.component';
import {KpiGridComponent} from '@shared/components/kpi-grid/kpi-grid.component';
import { AlertService } from '@core/services/Utils/alert.service';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';

type ChartKey = 'category' | 'channel' | 'yoy';

@Component({
  selector: 'app-credit-card-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartComponent,
    ChartPanelComponent,
    CreditCardPivotTableComponent,
    KpiGridComponent,
  ],
  templateUrl: './credit-card-analytics.component.html',
  styleUrl: './credit-card-analytics.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditCardAnalyticsComponent {
  private chartGenerator = inject(ChartGeneratorService);
  private alertService = inject(AlertService);

  /** Optional server-computed KPIs (Phase 5 RPC). */
  serverLastMonthKpi = input<CreditCardLastMonthSummary | null>(null);
  serverSpendTrendKpi = input<CreditCardKpiSummary | null>(null);
  serverYearComparisonKpi = input<CreditCardYearComparison | null>(null);
  isLoading = input(false);

  /** Rows after global filters (search + date). */
  filteredData = input<ICreditCardTransactionDto[]>([]);
  /** Search-filtered session rows — used for prior-year KPI lookups when a date filter is active. */
  allData = input<ICreditCardTransactionDto[]>([]);
  hasDateFilter = input(false);

  showVisualChart = signal(true);
  showYearMenu = signal(false);
  kpisCollapsed = signal(false);
  activeChart = signal<ChartKey>('channel');

  toggleKpisCollapsed(): void {
    this.kpisCollapsed.update(v => !v);
  }

  private readonly currentYear = new Date().getFullYear();
  selectedYears = signal<number[]>([this.currentYear, this.currentYear - 1]);
  selectedMonthIndices = signal<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  readonly chartConfigs: ChartConfig<ChartKey>[] = [
    {key: 'channel', label: 'Spend by Channel', icon: '🔗'},
    {key: 'category', label: 'Spend by Category', icon: '🏢'},
    {key: 'yoy', label: 'YoY Comparison', icon: '📅'},
  ];

  activeChartLabel = computed(() =>
    this.chartConfigs.find(c => c.key === this.activeChart())?.label ?? ''
  );

  private focusYear = computed(() =>
    resolveCreditCardFocusYear(this.selectedYears(), this.filteredData())
  );

  lastMonthSpendSummary = computed(() =>
    this.serverLastMonthKpi() ?? computeLastMonthSpendKpi(this.filteredData(), this.focusYear())
  );

  spendTrendSummary = computed(() =>
    this.serverSpendTrendKpi() ??
    computeMonthSpendTrendKpi(
      this.filteredData(),
      this.allData(),
      this.focusYear(),
      this.hasDateFilter()
    )
  );

  yearSpendComparison = computed(() =>
    this.serverYearComparisonKpi() ??
    computeYearSpendComparison(
      this.filteredData(),
      this.allData(),
      this.focusYear(),
      this.hasDateFilter()
    )
  );

  spendTrendPeriodLabel = computed(() => formatSpendTrendPeriodLabel(this.spendTrendSummary()));

  yearSpendPeriodLabel = computed(() => {
    const cmp = this.yearSpendComparison();
    return formatYearSpendPeriodLabel(cmp.currentYear, cmp.compareYear, cmp.currentMonth);
  });

  activeYearComparison = computed(() => {
    const raw = this.yearSpendComparison();
    return {
      ...raw,
      currentSpend: raw.currentTotal,
      compareSpend: raw.compareTotal,
    };
  });

  availableYears = computed(() => {
    const years = new Set<number>();
    for (const record of this.filteredData()) {
      years.add(getCreditCardYear(record));
    }
    return Array.from(years).sort((a, b) => b - a);
  });

  selectedYearsLabel = computed(() => {
    const years = this.selectedYears().slice().sort((a, b) => b - a);
    if (!years.length) return 'No years';
    if (years.length <= 2) return years.join(', ');
    return `${years.length} years selected`;
  });

  recordsForSelectedYears = computed(() => {
    const allowed = new Set(this.selectedYears());
    return this.filteredData().filter(record => allowed.has(getCreditCardYear(record)));
  });

  chartPivotData = computed(() =>
    buildYoyPivotData({
      records: this.recordsForSelectedYears(),
      getYear: getCreditCardYear,
      getMonth: getCreditCardMonth,
      getLabel: record =>
        this.resolveDimensionLabel(
          record,
          this.activeChart() === 'yoy' ? 'category' : this.activeChart()
        ),
      getValue: record => record.amount,
    })
  );

  spendPivotData = computed(() =>
    buildCreditCardSpendPivot({
      records: this.recordsForSelectedYears(),
      selectedYears: this.selectedYears(),
      selectedMonthIndices: this.selectedMonthIndices(),
    })
  );

  chartConfig = computed(() => {
    const key = this.activeChart();
    const data = this.chartPivotData();
    if (!data.length) return {type: 'pie' as const, data: {}, options: {}};

    if (key === 'yoy') {
      return this.chartGenerator.generateBarChart(
        data.map(y => String(y.year)),
        data.map(y => y.yearTotal),
        'Yearly Spend'
      );
    }

    const latestYear = data[0];
    const labels = latestYear.rows.map(r => r.label);
    const values = latestYear.rows.map(r => r.total);

    return key === 'channel'
      ? this.chartGenerator.generatePieChart(labels, values)
      : this.chartGenerator.generateDoughnutChart(labels, values);
  });

  toggleYear(year: number): void {
    this.selectedYears.update(current => {
      if (current.includes(year)) {
        const next = current.filter(y => y !== year);
        return next.length ? next : current;
      }
      return [...current, year].sort((a, b) => b - a);
    });
  }

  resetYearsToDefault(): void {
    this.selectedYears.set([this.currentYear, this.currentYear - 1]);
  }

  showLastMonthSpendInfo(): void {
    const last = this.lastMonthSpendSummary();
    this.alertService.info(
      'Last Month Spend',
      `Total spend for the full statement month before the latest transaction in ${this.focusYear()} ` +
        `(${last.periodLabel}): ${last.amount.toLocaleString('en-US', {style: 'currency', currency: 'USD'})}. ` +
        `${last.transactionCount} transaction${last.transactionCount === 1 ? '' : 's'}. ` +
        (last.statusMessage ? last.statusMessage : 'Respects search and date filters.')
    );
  }

  showSpendTrendInfo(): void {
    const trend = this.spendTrendSummary();
    const period = this.spendTrendPeriodLabel();
    this.alertService.info(
      'Spend Trend (YoY)',
      `Compares spend for the same statement month year-over-year (${period}). ` +
        `Change: ${trend.value >= 0 ? '+' : ''}${trend.value.toLocaleString('en-US', {style: 'currency', currency: 'USD'})} ` +
        `(${trend.isPositive ? '▼' : '▲'} ${trend.percentage.toFixed(1)}% — lower spend is favorable). ` +
        (trend.statusMessage ? `${trend.statusMessage} ` : '') +
        `Prior-year rows are loaded from the full session when a date filter is active.`
    );
  }

  showYearSpendComparisonInfo(): void {
    const cmp = this.activeYearComparison();
    const period = this.yearSpendPeriodLabel();
    const formatVal = (n: number) => n.toLocaleString('en-US', {style: 'currency', currency: 'USD'});
    this.alertService.info(
      'Year Spend Comparison',
      `${cmp.scopeLabel} ${cmp.currentYear}: ${formatVal(cmp.currentSpend)} ` +
        `(${cmp.isPositive ? '▼' : '▲'} ${cmp.percentage.toFixed(1)}% vs ${cmp.compareYear}). ` +
        `${cmp.scopeLabel} ${cmp.compareYear}: ${formatVal(cmp.compareSpend)}. ` +
        (cmp.statusMessage ? `${cmp.statusMessage} ` : '') +
        `Period: ${period}. Compares year-to-date spend (Jan through the latest statement month) vs the same months in the prior year.`
    );
  }

  private resolveDimensionLabel(
    transaction: {control?: string; channel?: string; salesChannel?: string; category?: string},
    dimension: ChartKey
  ): string {
    if (dimension === 'category') {
      return resolveControlCategory(transaction.control, transaction.category || 'Uncategorized');
    }
    if (dimension === 'channel') {
      return mapCreditCardChannel(transaction.channel || transaction.salesChannel);
    }
    return transaction.category || 'Uncategorized';
  }
}
