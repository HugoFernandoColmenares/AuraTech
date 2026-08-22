import { Component, input, output, computed, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartComponent } from '@shared/components/chart/chart.component';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { ChartPanelComponent } from '@shared/components/chart-panel/chart-panel.component';
import { TableHeaderActionsComponent } from '@shared/components/table-header-actions/table-header-actions.component';
import { ChartGeneratorService } from '@core/services/Utils/chart-generator.service';
import { ReferenceSheetDataService } from '@core/services/Excel/reference-sheet-data.service';
import { groupAndSumByKey } from '@core/auxiliar/array-utils.helper';
import { InventoryAnalyticsRpcResponse } from '@core/interfaces/report-analytics-rpc.interface';

type InventoryChartKey = 'division' | 'type' | 'brand';

@Component({
  selector: 'app-inventory-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartComponent,
    DataTableComponent,
    ChartPanelComponent,
    TableHeaderActionsComponent,
  ],
  templateUrl: './inventory-analytics.component.html',
  styleUrl: './inventory-analytics.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryAnalyticsComponent implements OnInit {
  private chartGenerator = inject(ChartGeneratorService);
  private referenceSheetService = inject(ReferenceSheetDataService);

  data = input.required<any[]>();
  serverAnalytics = input<InventoryAnalyticsRpcResponse | null>(null);

  exportJson = output<void>();
  exportToDatabase = output<void>();
  clearData = output<void>();
  fileSelected = output<Event>();
  showAlerts = output<void>();
  analyticsFiltersChange = output<{ excludeZeroAvailable: boolean; excludeZeroOnHand: boolean }>();

  showVisualChart = signal(true);
  excludeZeroAvailable = signal(true);
  excludeZeroOnHand = signal(true);
  activeChart = signal<InventoryChartKey>('division');

  readonly chartConfigs: { key: InventoryChartKey; label: string; icon: string }[] = [
    { key: 'division', label: 'Stock by Division', icon: '📊' },
    { key: 'type', label: 'Stock by Type', icon: '🏷️' },
    { key: 'brand', label: 'Stock by Brand', icon: '🏢' },
  ];

  private referenceData = this.referenceSheetService.getReferenceData();

  brandByParent = computed(() => {
    const map = new Map<string, string>();
    for (const ref of this.referenceData()) {
      map.set(ref.parent.toLowerCase(), ref.brand || 'Unknown');
    }
    return map;
  });

  filteredData = computed(() => {
    if (this.serverAnalytics()) return [];
    let rows = this.data();
    if (this.excludeZeroAvailable()) {
      rows = rows.filter(d => d.available !== 0);
    }
    if (this.excludeZeroOnHand()) {
      rows = rows.filter(d => d.onHand !== 0);
    }
    return rows;
  });

  private serverRowsForChart(key: InventoryChartKey) {
    const bundle = this.serverAnalytics();
    if (!bundle) return [];
    if (key === 'division') {
      return bundle.by_division.map(row => ({ name: row.division, stock: row.available }));
    }
    if (key === 'type') {
      return bundle.by_type.map(row => ({ name: row.type, stock: row.available }));
    }
    return bundle.by_brand.map(row => ({ name: row.brand, stock: row.available }));
  }

  activeChartLabel = computed(() =>
    this.chartConfigs.find(c => c.key === this.activeChart())?.label ?? ''
  );

  inventoryByDivision = computed(() => {
    const serverRows = this.serverRowsForChart('division');
    if (serverRows.length) {
      return this.chartGenerator.generatePieChart(
        serverRows.map(r => r.name),
        serverRows.map(r => r.stock),
        { plugins: { legend: { position: 'right' } } }
      );
    }
    const { labels, values } = groupAndSumByKey(this.filteredData(), 'division', 'available');
    return this.chartGenerator.generatePieChart(labels, values, { plugins: { legend: { position: 'right' } } });
  });

  inventoryByType = computed(() => {
    const serverRows = this.serverRowsForChart('type');
    if (serverRows.length) {
      return this.chartGenerator.generateBarChart(
        serverRows.map(r => r.name),
        serverRows.map(r => r.stock),
        'Stock',
        false,
        undefined,
        { plugins: { legend: { display: false } } }
      );
    }
    const { labels, values } = groupAndSumByKey(this.filteredData(), 'type', 'available');
    return this.chartGenerator.generateBarChart(labels, values, 'Stock', false, undefined, { plugins: { legend: { display: false } } });
  });

  inventoryByBrand = computed(() => {
    const serverRows = this.serverRowsForChart('brand');
    if (serverRows.length) {
      return this.chartGenerator.generateBarChart(
        serverRows.map(r => r.name),
        serverRows.map(r => r.stock),
        'Stock',
        false,
        undefined,
        { plugins: { legend: { display: false } } }
      );
    }
    const brandMap = this.brandByParent();
    const aggregated = new Map<string, number>();

    for (const item of this.filteredData()) {
      const parent = (item.sku?.split('-')[0] || '').toLowerCase();
      const brand = brandMap.get(parent) || 'Unknown';
      aggregated.set(brand, (aggregated.get(brand) ?? 0) + item.available);
    }

    const labels = Array.from(aggregated.keys());
    const values = Array.from(aggregated.values());
    return this.chartGenerator.generateBarChart(labels, values, 'Stock', false, undefined, { plugins: { legend: { display: false } } });
  });

  chartConfig = computed(() => {
    const key = this.activeChart();
    if (key === 'division') return this.inventoryByDivision();
    if (key === 'type') return this.inventoryByType();
    return this.inventoryByBrand();
  });

  private resolveChartLabel(item: { sku?: string; division?: string; type?: string }): string {
    const dimension = this.activeChart();
    if (dimension === 'brand') {
      const parent = (item.sku?.split('-')[0] || '').toLowerCase();
      return this.brandByParent().get(parent) || 'Unknown';
    }
    return item[dimension] || 'Unknown';
  }

  chartTableRows = computed(() => {
    const serverRows = this.serverRowsForChart(this.activeChart());
    if (serverRows.length) {
      const total = serverRows.reduce((sum, row) => sum + row.stock, 0);
      return serverRows
        .map(row => ({
          name: row.name,
          stock: row.stock,
          pct: total > 0 ? Number(((row.stock / total) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.stock - a.stock);
    }

    const grouped = new Map<string, number>();

    for (const item of this.filteredData()) {
      const label = this.resolveChartLabel(item);
      grouped.set(label, (grouped.get(label) ?? 0) + item.available);
    }

    const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(grouped.entries())
      .map(([name, stock]) => ({
        name,
        stock,
        pct: total > 0 ? Number(((stock / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.stock - a.stock);
  });

  chartTableColumns = computed<TableColumn[]>(() => {
    const dimensionLabel =
      this.activeChart() === 'division'
        ? 'Division'
        : this.activeChart() === 'type'
          ? 'Type'
          : 'Brand';

    return [
      { key: 'name', label: dimensionLabel, sortable: true },
      { key: 'stock', label: 'Available Stock', type: 'number', sortable: true },
      { key: 'pct', label: '% of Total', type: 'percent', sortable: true },
    ];
  });

  chartTableFooter = computed(() => {
    const rows = this.chartTableRows();
    if (!rows.length) return null;

    return {
      name: 'TOTAL',
      stock: rows.reduce((sum, row) => sum + row.stock, 0),
      pct: 100,
    };
  });

  ngOnInit(): void {
    if (!this.referenceData().length && !this.serverAnalytics()) {
      void this.referenceSheetService.fetchReferenceData();
    }
  }

  onExcludeZeroAvailableChange(value: boolean): void {
    this.excludeZeroAvailable.set(value);
    this.emitAnalyticsFilters();
  }

  onExcludeZeroOnHandChange(value: boolean): void {
    this.excludeZeroOnHand.set(value);
    this.emitAnalyticsFilters();
  }

  private emitAnalyticsFilters(): void {
    this.analyticsFiltersChange.emit({
      excludeZeroAvailable: this.excludeZeroAvailable(),
      excludeZeroOnHand: this.excludeZeroOnHand(),
    });
  }
}
