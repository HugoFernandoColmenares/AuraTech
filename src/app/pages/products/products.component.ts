import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { ProductService } from '@core/services/Excel/product.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { MainTableFilterComponent } from '@shared/main-table-filter/main-table-filter.component';
import { ProductsApiService } from '@core/services/api/products-api.service';
import { LoadingService } from '@core/services/Utils/loading.service';
import { BulkSyncService } from '@core/services/Utils/bulk-sync.service';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { DataExportService } from '@core/services/Utils/data-export.service';

@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, DataTableComponent, MainTableFilterComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private alertService = inject(AlertService);
  private productsApi = inject(ProductsApiService);
  private loadingService = inject(LoadingService);
  private bulkSync = inject(BulkSyncService);
  readonly rolePermissions = inject(RolePermissionService);
  private appStartup = inject(AppStartupService);
  private dataExport = inject(DataExportService);

  products = this.productService.products;

  isEditing = signal(false);
  editingId = signal<string | null>(null);
  showForm = signal(false);
  isLoading = this.loadingService.isLoading;
  initialDataReady = signal(false);
  tableSelectionReset = signal(0);
  totalRecords = signal(0);

  showContent = computed(() => this.initialDataReady());
  searchFilter = signal('');
  brandFilter = signal('');

  columns: TableColumn[] = [
    { key: 'parent', label: 'Parent', cssClass: 'mono' },
    { key: 'styleName', label: 'Style' },
    { key: 'brand', label: 'Brand' },
    { key: 'type', label: 'Type' },
    { key: 'collection', label: 'Collection' },
    { key: 'actions', label: 'Actions', type: 'action' }
  ];

  productForm = this.fb.group({
    parent: ['', [Validators.required]],
    styleName: ['', [Validators.required]],
    brand: ['', [Validators.required]],
    type: [''],
    collection: ['']
  });

  uniqueBrands = computed(() =>
    [...new Set(this.products().filter(p => p.isActive).map(p => p.brand).filter(Boolean))].sort()
  );

  filteredProducts = computed(() => {
    const search = this.searchFilter().toLowerCase();
    const brand = this.brandFilter();

    return this.products().filter(p => {
      if (!p.isActive) return false;

      const matchesSearch =
        p.parent.toLowerCase().includes(search) ||
        p.styleName.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search);

      const matchesBrand = brand === '' || p.brand === brand;
      return matchesSearch && matchesBrand;
    });
  });

  tableData = computed(() => this.filteredProducts() as unknown as Record<string, unknown>[]);

  ngOnInit(): void {
    void this.initProducts();
  }

  private async initProducts(): Promise<void> {
    await this.appStartup.whenReady();
    await this.productService.ensureLoaded();
    this.totalRecords.set(this.products().filter(p => p.isActive).length);
    this.initialDataReady.set(true);
  }

  toggleForm() {
    if (!this.showForm() && !this.rolePermissions.can('create')) {
      this.alertService.error('Access denied', 'You do not have permission to create products.');
      return;
    }
    this.showForm.update(v => !v);
    if (!this.showForm()) {
      this.resetForm();
    }
  }

  resetForm() {
    this.productForm.reset({ parent: '', styleName: '', brand: '', type: '', collection: '' });
    this.isEditing.set(false);
    this.editingId.set(null);
  }

  editProduct(product: IProductDto) {
    if (!this.rolePermissions.can('edit')) {
      this.alertService.error('Access denied', 'You do not have permission to edit products.');
      return;
    }
    this.isEditing.set(true);
    this.editingId.set(product.id);
    this.showForm.set(true);

    this.productForm.patchValue({
      parent: product.parent,
      styleName: product.styleName,
      brand: product.brand,
      type: product.type,
      collection: product.collection
    });
  }

  async saveProduct() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    if (this.isEditing() && !this.rolePermissions.can('edit')) {
      this.alertService.error('Access denied', 'You do not have permission to edit products.');
      return;
    }
    if (!this.isEditing() && !this.rolePermissions.can('create')) {
      this.alertService.error('Access denied', 'You do not have permission to create products.');
      return;
    }

    const formValue = this.productForm.value;
    const productData = {
      sku: formValue.parent!,
      parent: formValue.parent!,
      styleName: formValue.styleName!,
      brand: formValue.brand || '',
      type: formValue.type || '',
      collection: formValue.collection || ''
    };

    if (this.isEditing()) {
      await this.productService.updateProduct(this.editingId()!, productData);
    } else {
      await this.productService.addProduct(productData);
    }

    this.totalRecords.set(this.products().filter(p => p.isActive).length);
    this.toggleForm();
  }

  async deleteProduct(id: string) {
    if (!this.rolePermissions.can('delete')) {
      this.alertService.error('Access denied', 'You do not have permission to delete products.');
      return;
    }
    const result = await this.alertService.confirm(
      'Delete product?',
      'This action will mark the product as inactive.'
    );

    if (result.isConfirmed) {
      await this.productService.deleteProduct(id);
      this.totalRecords.set(this.products().filter(p => p.isActive).length);
      this.tableSelectionReset.update(n => n + 1);
    }
  }

  async deleteSelectedProducts(rows: Record<string, unknown>[]): Promise<void> {
    if (!this.rolePermissions.can('delete')) {
      this.alertService.error('Access denied', 'You do not have permission to delete products.');
      return;
    }

    const count = rows.length;
    const result = await this.alertService.confirm(
      'Deactivate selected products?',
      `This will mark ${count} product style${count === 1 ? '' : 's'} as inactive.`
    );
    if (!result.isConfirmed) return;

    for (const row of rows) {
      await this.productService.deleteProduct(row['id'] as string);
    }
    this.totalRecords.set(this.products().filter(p => p.isActive).length);
    this.tableSelectionReset.update(n => n + 1);
  }

  handleTableAction(event: { action: string, row: Record<string, unknown> }) {
    if (event.action === 'edit') {
      this.editProduct(event.row as unknown as IProductDto);
    } else if (event.action === 'delete') {
      void this.deleteProduct(event.row['id'] as string);
    }
  }

  handleBulkTableAction(event: { action: string; rows: unknown[] }): void {
    if (event.action !== 'bulkDelete') return;
    void this.deleteSelectedProducts(event.rows as Record<string, unknown>[]);
  }

  async exportTableToExcel(): Promise<void> {
    await this.dataExport.exportFromDatabase({
      fetch: () => this.productsApi.fetchAll(5000),
      mapRow: row => ({
        parent: row.parent,
        styleName: row.styleName,
        brand: row.brand,
        type: row.type,
        collection: row.collection,
      }),
      sheetName: 'Catalog',
      filePrefix: 'auratech_catalog_export',
      entityLabel: 'products',
    });
  }

  async exportToDatabase() {
    if (!this.rolePermissions.can('bulkUpload')) {
      this.alertService.error('Access denied', 'You do not have permission to export data.');
      return;
    }
    await this.bulkSync.exportLocalRecords({
      records: this.products(),
      upload: rows => this.productsApi.bulkUpload(rows),
      entityLabel: 'products',
      emptyMessage: 'There are no new products to export.',
      onSuccess: () => void this.productService.reloadFromApi(),
    });
  }
}
