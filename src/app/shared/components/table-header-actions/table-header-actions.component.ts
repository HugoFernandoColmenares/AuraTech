import { Component, input, output, ChangeDetectionStrategy, ViewChild, ElementRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { DataSourceIndicatorComponent } from '@shared/components/data-source-indicator/data-source-indicator.component';

@Component({
  selector: 'app-table-header-actions',
  standalone: true,
  imports: [CommonModule, DataSourceIndicatorComponent],
  templateUrl: './table-header-actions.component.html',
  styleUrl: './table-header-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableHeaderActionsComponent {
  private readonly permissions = inject(RolePermissionService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  title = input.required<string>();
  accept = input('.xlsx,.xls,.csv');
  showBulkActions = input<boolean | null>(null);
  localCount = input(0);
  databaseCount = input(0);

  canBulkUpload = computed(() => this.showBulkActions() ?? this.permissions.canBulkUpload());
  canExportToDatabase = computed(() => this.canBulkUpload() && this.localCount() > 0);

  exportJson = output<void>();
  exportExcel = output<void>();
  exportToDatabase = output<void>();
  clearData = output<void>();
  fileSelected = output<Event>();

  triggerUpload(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    this.fileSelected.emit(event);
  }
}
