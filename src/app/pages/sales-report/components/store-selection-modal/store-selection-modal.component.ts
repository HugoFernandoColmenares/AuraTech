import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreType } from '@core/interfaces/ISaleRecordDto.interface';

interface StoreOption {
  value: StoreType;
  name: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-store-selection-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './store-selection-modal.component.html',
  styleUrl: './store-selection-modal.component.css'
})
export class StoreSelectionModalComponent {
  pendingFileName = input<string>();
  confirm = output<StoreType>();
  cancel = output<void>();

  selectedStore = signal<StoreType>('generic-sales-report');

  readonly formatStores: StoreOption[] = [
    { value: 'generic-sales-report', name: 'GENERIC', icon: '📄', description: 'Standard sales template' },
    { value: 'custom-excel', name: 'CUSTOM EXCEL', icon: '🧩', description: 'Map your own Excel layout' }
  ];
}
