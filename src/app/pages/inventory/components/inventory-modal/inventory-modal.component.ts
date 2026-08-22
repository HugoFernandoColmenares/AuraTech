import { Component, input, output, model, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryAccount } from '@core/services/Excel/inventory.service';
import { RecordFormComponent } from '@shared/components/record-form/record-form.component';

interface InventorySourceOption {
  value: InventoryAccount;
  name: string;
  icon: string;
  description: string;
}

interface InventorySourceCategory {
  title: string;
  options: InventorySourceOption[];
}

@Component({
  selector: 'app-inventory-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RecordFormComponent],
  templateUrl: './inventory-modal.component.html',
  styleUrl: './inventory-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryModalComponent {
  showStoreSelection = input(false);
  showRecordForm = input(false);
  pendingFileName = input('');
  selectedAccount = model<InventoryAccount>('Inventory Dashboard');
  record = input<any>(null);
  formMode = input<'view' | 'edit' | 'create'>('view');

  storeConfirm = output<void>();
  storeCancel = output<void>();
  recordSave = output<any>();
  recordCancel = output<void>();

  readonly sourceCategories: InventorySourceCategory[] = [
    {
      title: 'Dashboards & Internal',
      options: [
        { value: 'Inventory Dashboard', name: 'Dashboard', icon: '📊', description: 'System Overview' },
        { value: 'YMI Internal Export', name: 'YMI Exported', icon: '💾', description: 'Internal Export Format' },
      ],
    },
    {
      title: 'Retail & Brands',
      options: [
        { value: 'Hyperstretch RP', name: 'Hyperstretch RP', icon: '👖', description: 'Retail Partner Sales' },
        { value: 'WBB Luxe', name: 'WBB Luxe', icon: '✨', description: 'Premium Brand Sales' },
      ],
    },
    {
      title: 'Warehouses',
      options: [
        { value: 'WH70', name: 'WH70', icon: '🏭', description: 'Warehouse 70 Inventory' },
        { value: 'WH10', name: 'WH10', icon: '🏢', description: 'Warehouse 10 Inventory' },
      ],
    },
  ];
}
