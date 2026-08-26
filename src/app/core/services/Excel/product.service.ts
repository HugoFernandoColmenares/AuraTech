import { Injectable, signal, inject } from '@angular/core';
import { IProductDto } from '@core/interfaces/IProductDto.interface';
import { AlertService } from '@core/services/Utils/alert.service';
import { ProductsApiService } from '@core/services/api/products-api.service';
import { HealthService } from '@core/services/bootstrap/health.service';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private alertService = inject(AlertService);
  private productsApi = inject(ProductsApiService);
  private health = inject(HealthService);

  private loadPromise: Promise<void> | null = null;

  products = signal<IProductDto[]>([]);

  setProducts(data: IProductDto[]): void {
    this.products.set(data.map(r => ({ ...r, isLocal: false })));
  }

  /** Loads products once per session. */
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

  async reloadFromApi(): Promise<void> {
    this.productsApi.invalidateListCache();
    this.invalidateCache();
    await this.ensureLoaded();
  }

  private async loadFromApi(): Promise<void> {
    await this.health.whenReady();
    await this.productsApi.ensureListCache();
    if (!this.productsApi.isListCacheReady()) return;
    this.setProducts(this.productsApi.cachedItems());
  }

  mergeImportedProducts(newProducts: IProductDto[]): void {
    this.products.update(current => {
      const merged = [...current];
      for (const newItem of newProducts) {
        const incoming = { ...newItem, sku: newItem.sku || newItem.parent };
        const existingIdx = merged.findIndex(
          p => p.parent.toLowerCase() === incoming.parent.toLowerCase()
        );
        if (existingIdx !== -1) {
          merged[existingIdx] = { ...merged[existingIdx], ...incoming };
        } else {
          merged.push(incoming);
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
      const saved = await this.productsApi.create(payload);
      this.products.update(prev => [...prev, saved].sort((a, b) => a.parent.localeCompare(b.parent)));
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
      await this.productsApi.updateByParent(parentKey, { ...product, sku: parentKey });
      this.products.update(prev =>
        prev.map(p => (p.id === id ? { ...p, ...product, sku: parentKey, parent: parentKey } : p))
      );
      this.alertService.success('Success', 'Product updated.');
    } catch {
      this.alertService.error('Error', 'Could not update the product.');
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const current = this.products().find(p => p.id === id);
    if (!current) return;

    try {
      await this.productsApi.deactivateByParent(current.parent);
      this.products.update(prev =>
        prev.map(p =>
          p.parent.toLowerCase() === current.parent.toLowerCase() ? { ...p, isActive: false } : p
        )
      );
      this.alertService.success('Deleted', 'The product has been marked as inactive.');
    } catch {
      this.alertService.error('Error', 'Could not deactivate the product.');
    }
  }

  private isDuplicate(parent: string): boolean {
    return this.products().some(p => p.parent.toLowerCase() === parent.toLowerCase() && p.isActive);
  }
}
