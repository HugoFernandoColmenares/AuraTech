import { Component, input, output, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { TableHeaderActionsComponent } from '@shared/components/table-header-actions/table-header-actions.component';
import { RolePermissionService } from '@core/services/auth/role-permission.service';

@Component({
  selector: 'app-inventory-table',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, TableHeaderActionsComponent],
  templateUrl: './inventory-table.component.html',
  styleUrl: './inventory-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryTableComponent {
  readonly permissions = inject(RolePermissionService);
  readonly canCreate = computed(() => this.permissions.canCreate());

  data = input.required<any[]>();
  columns = input.required<TableColumn[]>();
  isSkuSplit = input(false);
  selectionReset = input(0);

  localCount = input(0);
  databaseCount = input(0);

  isSkuSplitChange = output<boolean>();
  createRecord = output<void>();
  actionClick = output<{ action: string; row: any }>();
  bulkActionClick = output<{ action: string; rows: unknown[] }>();
  exportJson = output<void>();
  exportExcel = output<void>();
  exportToDatabase = output<void>();
  clearData = output<void>();
  fileSelected = output<Event>();
}
