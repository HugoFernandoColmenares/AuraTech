import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReferenceSheetDataService } from '@core/services/Excel/reference-sheet-data.service';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { MainTableFilterComponent } from '@shared/main-table-filter/main-table-filter.component';
import { ReferenceSheetApiService } from '@core/services/api/reference-sheet-api.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { BulkSyncService } from '@core/services/Utils/bulk-sync.service';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { ProductService } from '@core/services/Excel/product.service';

@Component({
  selector: 'app-reference-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, MainTableFilterComponent],
  templateUrl: './reference-sheet.component.html',
  styleUrl: './reference-sheet.component.css'
})
export class ReferenceSheetComponent implements OnInit {
  private referenceService = inject(ReferenceSheetDataService);
  private referenceApi = inject(ReferenceSheetApiService);
  private alertService = inject(AlertService);
  private bulkSync = inject(BulkSyncService);
  private appStartup = inject(AppStartupService);
  private productService = inject(ProductService);

  /** Local fetch state — avoids blocking on unrelated global HTTP loaders. */
  isRefreshing = signal(false);
  initialDataReady = signal(false);
  referenceData = this.referenceService.getReferenceData();
  isHydrated = this.referenceService.isHydrated;
  transportMessage = this.referenceApi.transportMessage;

  searchFilter = signal('');
  brandFilter = signal('');

  columns: TableColumn[] = [
    { key: 'parent', label: 'Parent', cssClass: 'mono' },
    { key: 'styleName', label: 'Style Name' },
    { key: 'brand', label: 'Brand' },
    { key: 'div', label: 'Division' },
    { key: 'type', label: 'Type' },
    { key: 'collection', label: 'Collection' },
    { key: 'fit', label: 'Fit' }
  ];

  availableBrands = computed(() => {
    return [...new Set(this.referenceData().map(item => item.brand).filter(Boolean))].sort();
  });

  filteredData = computed(() => {
    const search = this.searchFilter().toLowerCase().trim();
    const brand = this.brandFilter();
    let data = this.referenceData();

    if (brand) {
      data = data.filter(item => item.brand === brand);
    }

    if (search) {
      data = data.filter(item => {
        return (
          item.parent?.toLowerCase().includes(search) ||
          item.styleName?.toLowerCase().includes(search) ||
          item.brand?.toLowerCase().includes(search) ||
          item.div?.toLowerCase().includes(search) ||
          item.type?.toLowerCase().includes(search) ||
          item.collection?.toLowerCase().includes(search) ||
          item.fit?.toLowerCase().includes(search)
        );
      });
    }
    return data;
  });

  async ngOnInit(): Promise<void> {
    await this.appStartup.whenReady();

    if (this.isHydrated()) {
      this.initialDataReady.set(true);
      return;
    }

    await this.refreshReferenceData(false);
    this.initialDataReady.set(true);
  }

  async refreshReferenceData(force = true): Promise<void> {
    if (this.isRefreshing()) return;

    this.isRefreshing.set(true);
    try {
      await this.referenceService.fetchReferenceData(force ? { force: true } : undefined);
      this.productService.rehydrateCatalogLabels();
    } catch (err: unknown) {
      console.warn('[ReferenceSheetComponent] Failed to load reference data:', err);
      this.alertService.error('Connection Error', 'Could not load reference sheet data.');
    } finally {
      this.isRefreshing.set(false);
    }
  }

  async exportToDatabase() {
    await this.bulkSync.exportLocalRecords({
      records: this.referenceData(),
      upload: rows => this.referenceApi.bulkUpload(rows),
      entityLabel: 'reference records',
      emptyMessage: 'There are no new reference records to export.',
      onSuccess: () => {
        void this.referenceService.reloadFromApi().then(() => {
          this.productService.rehydrateCatalogLabels();
        });
      },
    });
  }

  clearFilters() {
    this.searchFilter.set('');
    this.brandFilter.set('');
  }
}
