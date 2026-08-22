import { Injectable, signal, inject } from '@angular/core';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { CatalogDataService } from '@core/services/catalog/catalog-data.service';
import { BrandsApiService } from '@core/services/api/brands-api.service';
import { DivisionsApiService } from '@core/services/api/divisions-api.service';
import { CollectionsApiService } from '@core/services/api/collections-api.service';
import { ProductTypesApiService } from '@core/services/api/product-types-api.service';
import { FitsApiService } from '@core/services/api/fits-api.service';
import { IBrandDto, ICollectionDto, IDivisionDto, IProductTypeDto, IFitDto } from '@core/interfaces/IBaseCatalogDto.interface';
import { AlertService } from '@core/services/Utils/alert.service';
import { ProductsApiService } from '@core/services/api/products-api.service';
import { HealthService } from '@core/services/bootstrap/health.service';
import { ReferenceSheetDataService } from '@core/services/Excel/reference-sheet-data.service';
import { shouldUseSupabaseData } from '@core/auxiliar/supabase-transport.util';
import { EnvConfig } from '@core/config/env.config';
import {
  buildProductCatalogHydrateContext,
  hydrateProductCatalog,
  normalizeProductCatalogRows,
} from '@core/auxiliar/product-catalog.util';
import { ProductCatalogIdContext } from '@core/auxiliar/product-payload.util';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private alertService = inject(AlertService);
  private catalog = inject(CatalogDataService);
  private brandsApi = inject(BrandsApiService);
  private divisionsApi = inject(DivisionsApiService);
  private collectionsApi = inject(CollectionsApiService);
  private typesApi = inject(ProductTypesApiService);
  private fitsApi = inject(FitsApiService);
  private productsApi = inject(ProductsApiService);
  private health = inject(HealthService);
  private env = inject(EnvConfig);
  private referenceData = inject(ReferenceSheetDataService);

  private loadPromise: Promise<void> | null = null;

  products = signal<IProductDto[]>([]);

  brands = this.catalog.brands;
  divisions = this.catalog.divisions;
  collections = this.catalog.collections;
  types = this.catalog.types;
  fits = this.catalog.fits;

  setProducts(data: IProductDto[]): void {
    this.products.set(data.map(r => ({ ...r, isLocal: false })));
  }

  /** Loads products once per session (from API cache warmed at startup). */
  async ensureLoaded(): Promise<void> {
    if (this.products().length > 0) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadFromApi();
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  invalidateCache(): void {
    this.loadPromise = null;
    this.products.set([]);
  }

  /** Refetch after create / update / delete mutations. */
  async reloadFromApi(): Promise<void> {
    this.productsApi.invalidateListCache();
    this.invalidateCache();
    await this.ensureLoaded();
  }

  /** Re-apply reference + catalog labels after reference sheet refresh. */
  rehydrateCatalogLabels(): void {
    if (!this.products().length) return;

    const rows = normalizeProductCatalogRows(this.products(), this.hydrateContext());
    this.setProducts(rows);
  }

  private hydrateContext() {
    return buildProductCatalogHydrateContext(
      this.catalog.brands(),
      this.catalog.divisions(),
      this.catalog.types(),
      this.catalog.collections(),
      this.catalog.fits(),
      this.referenceData.getReferenceData()()
    );
  }

  private catalogPersistContext(): ProductCatalogIdContext {
    return {
      brands: this.catalog.brands(),
      divisions: this.catalog.divisions(),
      types: this.catalog.types(),
      collections: this.catalog.collections(),
      fits: this.catalog.fits(),
    };
  }

  private useSupabasePersist(): boolean {
    return shouldUseSupabaseData(this.env, this.health);
  }

  private async loadFromApi(): Promise<void> {
    await this.health.whenReady();
    await Promise.all([this.catalog.loadAll(), this.referenceData.fetchReferenceData()]);
    await this.productsApi.ensureListCache();

    if (!this.productsApi.isListCacheReady()) {
      return;
    }

    const rows = normalizeProductCatalogRows(this.productsApi.cachedItems(), this.hydrateContext());
    this.setProducts(rows);
  }

  mergeImportedProducts(newProducts: IProductDto[]): void {
    const ctx = this.hydrateContext();

    this.products.update(current => {
      const merged = [...current];
      for (const newItem of newProducts) {
        const hydrated = hydrateProductCatalog({ ...newItem, sku: newItem.parent }, ctx);
        const existingIdx = merged.findIndex(
          p => p.parent.toLowerCase() === hydrated.parent.toLowerCase()
        );
        if (existingIdx !== -1) {
          merged[existingIdx] = { ...merged[existingIdx], ...hydrated };
        } else {
          merged.push(hydrated);
        }
      }
      return merged.sort((a, b) => a.parent.localeCompare(b.parent));
    });
  }

  async addProduct(product: Omit<IProductDto, 'id' | 'isActive'>): Promise<void> {
    if (this.isDuplicate(product.parent)) {
      this.alertService.error('Error', 'The PARENT code already exists.');
      return;
    }

    const payload = {
      ...product,
      sku: product.sku || product.parent,
      isActive: true,
    };

    try {
      if (this.useSupabasePersist()) {
        const saved = await this.productsApi.createProduct(payload, this.catalogPersistContext());
        const hydrated = hydrateProductCatalog(
          { ...saved, sku: saved.parent },
          this.hydrateContext()
        );
        this.products.update(prev => [...prev, hydrated].sort((a, b) => a.parent.localeCompare(b.parent)));
      } else {
        const newProduct: IProductDto = {
          ...payload,
          id: crypto.randomUUID(),
        };
        this.products.update(prev => [...prev, newProduct]);
      }
      this.alertService.success('Success', 'Product added correctly.');
    } catch {
      this.alertService.error('Error', 'Could not save the product.');
    }
  }

  async updateProduct(id: string, product: Partial<IProductDto>): Promise<void> {
    const current = this.products().find(p => p.id === id);
    if (
      product.parent &&
      current &&
      product.parent.toLowerCase() !== current.parent.toLowerCase() &&
      this.isDuplicate(product.parent)
    ) {
      this.alertService.error('Error', 'The PARENT code already exists.');
      return;
    }

    const parentKey = (product.parent ?? current?.parent ?? '').trim();
    if (!parentKey) return;

    try {
      if (this.useSupabasePersist()) {
        await this.productsApi.updateByParent(parentKey, product, this.catalogPersistContext());
        await this.reloadFromApi();
      } else {
        this.products.update(prev => prev.map(p => (p.id === id ? { ...p, ...product, sku: parentKey } : p)));
      }
      this.alertService.success('Success', 'Product updated.');
    } catch {
      this.alertService.error('Error', 'Could not update the product.');
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const current = this.products().find(p => p.id === id);
    if (!current) return;

    try {
      if (this.useSupabasePersist()) {
        await this.productsApi.deactivateByParent(current.parent);
        this.products.update(prev =>
          prev.map(p =>
            p.parent.toLowerCase() === current.parent.toLowerCase()
              ? { ...p, isActive: false }
              : p
          )
        );
      } else {
        this.products.update(prev =>
          prev.map(p =>
            p.parent.toLowerCase() === current.parent.toLowerCase()
              ? { ...p, isActive: false }
              : p
          )
        );
      }
      this.alertService.success('Deleted', 'The product has been marked as inactive.');
    } catch {
      this.alertService.error('Error', 'Could not deactivate the product.');
    }
  }

  private isDuplicate(parent: string): boolean {
    return this.products().some(p => p.parent.toLowerCase() === parent.toLowerCase() && p.isActive);
  }

  async addBrand(name: string): Promise<IBrandDto> {
    return this.addCatalogViaApi(name, this.brands(), () =>
      this.brandsApi.create({ name, isActive: true })
    );
  }

  async addDivision(name: string): Promise<IDivisionDto> {
    return this.addCatalogViaApi(name, this.divisions(), () =>
      this.divisionsApi.create({ name, isActive: true })
    );
  }

  async addCollection(name: string): Promise<ICollectionDto> {
    return this.addCatalogViaApi(name, this.collections(), () =>
      this.collectionsApi.create({ name, isActive: true })
    );
  }

  async addType(name: string): Promise<IProductTypeDto> {
    return this.addCatalogViaApi(name, this.types(), () =>
      this.typesApi.create({ name, isActive: true })
    );
  }

  async addFit(name: string): Promise<IFitDto> {
    return this.addCatalogViaApi(name, this.fits(), () =>
      this.fitsApi.create({ name, isActive: true })
    );
  }

  private async addCatalogViaApi<T extends { id: string; name: string; isActive: boolean }>(
    name: string,
    items: T[],
    create: () => Promise<T>
  ): Promise<T> {
    const existing = items.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (existing?.id) return existing;
    if (existing) return existing;
    return create();
  }
}
