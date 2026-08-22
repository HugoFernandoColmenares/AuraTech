import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { TableHeaderActionsComponent } from '@shared/components/table-header-actions/table-header-actions.component';
import { generateSalesTableColumns } from '@core/data/sales-table-columns';
import { buildStyleNameMap, enrichSaleRowWithSku } from '@core/auxiliar/reference-lookup.utils';

@Component({
  selector: 'app-sales-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, TableHeaderActionsComponent],
  templateUrl: './sales-table.component.html',
  styleUrl: './sales-table.component.css',
})
export class SalesTableComponent {
  totalRecords = input<number>(0);
  filteredRows = input<unknown[]>([]);
  serverSide = input<boolean>(false);
  page = input<number>(1);
  referenceData = input<{ parent: string; styleName: string }[]>([]);

  showStyleName = input<boolean>(false);
  toggleStyleName = output<boolean>();

  refreshData = output<{ page: number; limit: number }>();
  tableAction = output<{ action: string; row: unknown }>();
  bulkActionClick = output<{ action: string; rows: unknown[] }>();
  createRecord = output<void>();
  selectionReset = input(0);

  localCount = input(0);
  databaseCount = input(0);

  exportJson = output<any[]>();
  exportExcel = output<void>();
  exportToDatabase = output<void>();
  clearData = output<void>();
  fileSelected = output<Event>();

  showAccount = signal<boolean>(true);
  showCost = signal<boolean>(false);
  isSkuSplit = signal<boolean>(false);

  columns = computed<TableColumn[]>(() =>
    generateSalesTableColumns({
      showAccount: this.showAccount(),
      showCost: this.showCost(),
      isSkuSplit: this.isSkuSplit(),
      showStyleName: this.showStyleName(),
    })
  );

  tableData = computed(() => {
    const styleNameMap = buildStyleNameMap(this.referenceData());
    return this.filteredRows().map(r => enrichSaleRowWithSku(r as { sku: string }, styleNameMap));
  });

  onPageChange(page: number): void {
    if (this.serverSide()) {
      this.refreshData.emit({ page, limit: 20 });
    }
  }

  openCreateForm(): void {
    this.createRecord.emit();
  }

  handleTableAction(event: { action: string; row: unknown }): void {
    this.tableAction.emit(event);
  }

  handleBulkAction(event: { action: string; rows: unknown[] }): void {
    this.bulkActionClick.emit(event);
  }
}
