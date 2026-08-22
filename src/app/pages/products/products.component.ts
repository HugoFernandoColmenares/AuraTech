import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { DataTableComponent, TableColumn } from '@shared/components/data-table/data-table.component';
import { ProductService } from '@core/services/Excel/product.service';
import { ProductExcelImportService } from '@core/services/Excel/product-excel-import.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { MainTableFilterComponent } from '@shared/main-table-filter/main-table-filter.component';
import { ProductsApiService } from '@core/services/api/products-api.service';
import { LoadingService } from '@core/services/Utils/loading.service';
import { BulkSyncService } from '@core/services/Utils/bulk-sync.service';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { resolveCatalogItemId } from '@core/auxiliar/product-catalog.util';
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
  private productExcelImport = inject(ProductExcelImportService);
  private alertService = inject(AlertService);
  private productsApi = inject(ProductsApiService);
  private loadingService = inject(LoadingService);
  private bulkSync = inject(BulkSyncService);
  readonly rolePermissions = inject(RolePermissionService);
  private appStartup = inject(AppStartupService);
  private dataExport = inject(DataExportService);

  // Exponer señales del servicio
  products = this.productService.products;
  brands = this.productService.brands;
  divisions = this.productService.divisions;
  types = this.productService.types;
  collections = this.productService.collections;
  fits = this.productService.fits;

  // Estado local para UI
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
    { key: 'brandName', label: 'Brand' },
    { key: 'divisionName', label: 'Division' },
    { key: 'typeName', label: 'Type' },
    { key: 'collectionName', label: 'Collection' },
    { key: 'actions', label: 'Actions', type: 'action' }
  ];

  // Formulario
  productForm = this.fb.group({
    parent: ['', [Validators.required]],
    styleName: ['', [Validators.required]],
    brand: [null as unknown, [Validators.required]],
    division: [null as unknown, [Validators.required]],
    type: [null as unknown, [Validators.required]],
    collection: [null as unknown, [Validators.required]],
    fit: [null as unknown]
  });

  // Datos filtrados
  filteredProducts = computed(() => {
    const search = this.searchFilter().toLowerCase();
    const brandId = this.brandFilter();

    return this.products().filter(p => {
      if (!p.isActive) return false;

      const matchesSearch = p.parent.toLowerCase().includes(search) ||
        p.styleName.toLowerCase().includes(search);
      
      const pBrandId = resolveCatalogItemId(p.brand, this.brands());
      const matchesBrand = brandId === '' || pBrandId === brandId;

      return matchesSearch && matchesBrand;
    });
  });

  tableData = computed(() => {
    return this.filteredProducts().map(p => ({
      ...p,
      brandName: this.catalogLabel(p.brand),
      divisionName: this.catalogLabel(p.division),
      typeName: this.catalogLabel(p.type),
      collectionName: this.catalogLabel(p.collection),
    })) as unknown as Record<string, unknown>[];
  });

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
    this.productForm.reset();
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
      division: product.division,
      type: product.type,
      collection: product.collection,
      fit: product.fit
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
      brand: formValue.brand as any, // Internal cast to keep it simple with existing service
      division: formValue.division as any,
      type: formValue.type as any,
      collection: formValue.collection as any,
      fit: formValue.fit as any
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

  onFileSelected(event: Event) {
    if (!this.rolePermissions.can('bulkUpload')) {
      this.alertService.error('Access denied', 'You do not have permission to import data.');
      return;
    }
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      void this.productExcelImport.loadFromExcel(file);
      target.value = '';
    }
  }

  // Métodos para catálogos dinámicos
  async addNewItem(catalogType: string) {
    if (!this.rolePermissions.can('create')) {
      this.alertService.error('Access denied', 'You do not have permission to modify catalogs.');
      return;
    }

    const { value: name } = await this.alertService.Swal.fire({
      title: `Add new ${catalogType}`,
      input: 'text',
      inputLabel: 'Name',
      showCancelButton: true,
      confirmButtonColor: '#0f766e',
      inputValidator: (value: string) => {
        if (!value) return 'You must enter a name!';
        return null;
      }
    });

    if (name) {
      let newItem;
      switch (catalogType) {
        case 'Brand': newItem = await this.productService.addBrand(name); break;
        case 'Division': newItem = await this.productService.addDivision(name); break;
        case 'Type': newItem = this.productService.addType(name); break;
        case 'Collection': newItem = await this.productService.addCollection(name); break;
        case 'Fit': newItem = this.productService.addFit(name); break;
      }

      if (newItem) {
        const patch: Record<string, unknown> = {};
        patch[catalogType.toLowerCase()] = newItem;
        this.productForm.patchValue(patch);
      }
    }
  }

  compareById(o1: {id: string} | null, o2: {id: string} | null): boolean {
    return o1 && o2 ? o1.id === o2.id : o1 === o2;
  }

  private catalogLabel(value: string | { name?: string } | null | undefined): string {
    if (!value) return '—';
    if (typeof value === 'string') return value.trim() || '—';
    return value.name?.trim() || '—';
  }

  async exportTableToExcel(): Promise<void> {
    await this.dataExport.exportFromDatabase({
      fetch: () => this.productsApi.fetchAll(5000),
      mapRow: row => ({
        parent: row.parent,
        styleName: row.styleName,
        brand: this.catalogLabel(row.brand),
        division: this.catalogLabel(row.division),
        type: this.catalogLabel(row.type),
        collection: this.catalogLabel(row.collection),
        fit: this.catalogLabel(row.fit),
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
      upload: rows =>
        this.productsApi.bulkUploadWithCatalog(rows, {
          brands: this.brands(),
          divisions: this.divisions(),
          types: this.types(),
          collections: this.collections(),
          fits: this.fits(),
        }),
      entityLabel: 'products',
      emptyMessage: 'There are no new products to export.',
      onSuccess: () => void this.productService.reloadFromApi(),
    });
  }
}
