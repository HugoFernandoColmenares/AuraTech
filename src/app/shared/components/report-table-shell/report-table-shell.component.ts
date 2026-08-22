import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { TableHeaderActionsComponent } from '@shared/components/table-header-actions/table-header-actions.component';

@Component({
  selector: 'app-report-table-shell',
  standalone: true,
  imports: [CommonModule, DataTableComponent, TableHeaderActionsComponent],
  templateUrl: './report-table-shell.component.html',
  styleUrl: './report-table-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportTableShellComponent {
  title = input.required<string>();
  columns = input.required<TableColumn[]>();
  data = input.required<unknown[]>();
  pageSize = input(20);
  serverSide = input(false);
  totalRecords = input<number>(0);
  accept = input('.xlsx,.xls,.csv');

  selectionReset = input(0);
  selectable = input<boolean | null>(null);
  rowKey = input('id');

  localCount = input(0);
  databaseCount = input(0);

  exportJson = output<void>();
  exportExcel = output<void>();
  exportToDatabase = output<void>();
  clearData = output<void>();
  fileSelected = output<Event>();
  pageChange = output<number>();
  actionClick = output<{ action: string; row: unknown }>();
  bulkActionClick = output<{ action: string; rows: unknown[] }>();
}
