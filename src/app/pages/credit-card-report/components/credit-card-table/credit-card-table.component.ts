import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableColumn } from '@shared/components/data-table/data-table.component';
import { ReportTableShellComponent } from '@shared/components/report-table-shell/report-table-shell.component';

@Component({
  selector: 'app-credit-card-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ReportTableShellComponent],
  templateUrl: './credit-card-table.component.html',
  styleUrl: './credit-card-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreditCardTableComponent {
  data = input.required<unknown[]>();
  totalRecords = input<number>(0);
  serverSide = input<boolean>(false);
  selectionReset = input(0);

  localCount = input(0);
  databaseCount = input(0);

  exportJson = output<void>();
  exportExcel = output<void>();
  exportToDatabase = output<void>();
  clearData = output<void>();
  fileSelected = output<Event>();
  pageChange = output<{ page: number; limit: number }>();
  tableAction = output<{ action: string; row: unknown }>();
  bulkActionClick = output<{ action: string; rows: unknown[] }>();

  columns: TableColumn[] = [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'description', label: 'Description' },
    { key: 'channel', label: 'Channel' },
    { key: 'dept', label: 'Dept' },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'category', label: 'Category' },
    { key: 'cityState', label: 'Location' },
    { key: 'actions', label: 'Actions', type: 'action' },
  ];
}
