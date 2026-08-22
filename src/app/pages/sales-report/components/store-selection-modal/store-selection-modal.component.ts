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
  /**
   * Input for the name of the file being processed.
   * Accessibility: Used to inform the user which file is being configured.
   */
  pendingFileName = input<string>();

  /**
   * Emits the selected store type when the user confirms.
   */
  confirm = output<StoreType>();

  /**
   * Emits when the user cancels the modal.
   */
  cancel = output<void>();

  /**
   * Local state for the currently selected store.
   * Signal-based state management for performance.
   */
  selectedStore = signal<StoreType>('amazon-dropshipping');

  /**
   * Refactored store options categorized for better organization (SOLID - SRP)
   */
  readonly retailStores: StoreOption[] = [
    { value: 'amazon-dropshipping', name: 'AMAZON DS', icon: '📦', description: 'Dropshipping Excel' },
    { value: 'amazon-retail', name: 'AMAZON RP', icon: '🛒', description: 'Retail Central' },
    { value: 'walmart-wfs', name: 'WALMART WFS', icon: '🏬', description: 'Walmart Fulfillment' },
    { value: 'ymi-retail', name: 'YMI RETAIL', icon: '🛍️', description: 'Shopify Collective' },
    { value: 'rmf-website', name: 'RMF WEBSITE', icon: '🌐', description: 'Shopify Retail Web' }
  ];

  readonly wholesaleStores: StoreOption[] = [
    { value: 'fashion-go', name: 'FASHIONGO', icon: '👗', description: 'Wholesale Orders' },
    { value: 'faire', name: 'FAIRE', icon: '🎨', description: 'Wholesale Marketplace' },
    { value: 'ymi-wholesale', name: 'YMI Wholesale', icon: '🏢', description: 'Wholesale Shopify' }
  ];

  readonly internalStores: StoreOption[] = [
    { value: 'ymi-internal', name: 'YMI EXPORTED', icon: '💾', description: 'Data exported from this app' },
    { value: 'generic-sales-report', name: 'GENERIC', icon: '📄', description: 'Standard Template' }
  ];

  readonly customStores: StoreOption[] = [
    { value: 'custom-excel', name: 'CUSTOM EXCEL', icon: '🧩', description: 'Map your own Excel layout' }
  ];
}
