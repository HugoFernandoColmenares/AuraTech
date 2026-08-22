import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IProductDto } from '../../interfaces/IProductDto.interface';
import {
  ENRICHED_PRODUCT_SELECT_COLUMNS,
  mapEnrichedProductRow,
  mapSupabaseProductRow,
  prepareProductForUpload,
  PRODUCT_WRITE_SELECT_COLUMNS,
  ProductCatalogIdContext,
} from '@core/auxiliar/product-payload.util';
import { LocalStorageEntityStore } from '@core/data/local-storage-entity.store';

@Injectable({ providedIn: 'root' })
export class ProductsApiService extends BaseSupabaseApiService<IProductDto> {
  protected override tableKey = 'products' as const;
  protected override useListCache = true;
  protected override get listSourceTable(): string {
    return 'products_parent_catalog';
  }
  protected override selectColumns = ENRICHED_PRODUCT_SELECT_COLUMNS;
  protected override get writeSelectColumns(): string {
    return PRODUCT_WRITE_SELECT_COLUMNS;
  }
  protected override orderColumn = 'parent';

  private persistCatalogCtx: ProductCatalogIdContext | null = null;

  protected override mapRow(row: Record<string, unknown>): IProductDto {
    return mapEnrichedProductRow(row);
  }

  protected override mapWriteRow(row: Record<string, unknown>): IProductDto {
    return mapSupabaseProductRow(row);
  }

  protected override prepareRowForUpload(row: Record<string, unknown>): Record<string, unknown> {
    return prepareProductForUpload(row, this.persistCatalogCtx ?? undefined);
  }

  async withCatalogContext<T>(
    catalogCtx: ProductCatalogIdContext,
    operation: () => Promise<T>
  ): Promise<T> {
    this.persistCatalogCtx = catalogCtx;
    try {
      return await operation();
    } finally {
      this.persistCatalogCtx = null;
    }
  }

  async createProduct(
    data: Partial<IProductDto>,
    catalogCtx: ProductCatalogIdContext
  ): Promise<IProductDto> {
    return this.withCatalogContext(catalogCtx, () => super.create(data));
  }

  async updateByParent(
    parent: string,
    data: Partial<IProductDto>,
    catalogCtx: ProductCatalogIdContext
  ): Promise<void> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      const rows = LocalStorageEntityStore.load<IProductDto>('products').map(row =>
        row.parent === parent ? { ...row, ...data, parent } : row
      );
      LocalStorageEntityStore.save('products', rows);
      this.invalidateListCache();
      return;
    }

    await this.withCatalogContext(catalogCtx, async () => {
      this.beginTransport('write', `Updating products for ${parent}…`);
      try {
        const payload = this.prepareRowForUpload(data as Record<string, unknown>);
        delete payload['id'];
        delete payload['sku'];

        const client = this.supabase.getClient();
        if (!client) throw new Error('Supabase is not configured.');

        const { error } = await client.from(this.tableName).update(payload).eq('parent', parent);
        if (error) this.throwSupabaseError(error);
        this.invalidateListCache();
      } finally {
        this.transportState.end();
      }
    });
  }

  async deactivateByParent(parent: string): Promise<void> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      const rows = LocalStorageEntityStore.load<IProductDto>('products').map(row =>
        row.parent === parent ? { ...row, isActive: false } : row
      );
      LocalStorageEntityStore.save('products', rows);
      this.invalidateListCache();
      return;
    }

    this.beginTransport('write', `Deactivating products for ${parent}…`);
    try {
      const client = this.supabase.getClient();
      if (!client) throw new Error('Supabase is not configured.');

      const { error } = await client
        .from(this.tableName)
        .update({ is_active: false })
        .eq('parent', parent);
      if (error) this.throwSupabaseError(error);
      this.invalidateListCache();
    } finally {
      this.transportState.end();
    }
  }

  async bulkUploadWithCatalog(
    data: IProductDto[],
    catalogCtx: ProductCatalogIdContext
  ): Promise<Awaited<ReturnType<ProductsApiService['bulkUpload']>>> {
    return this.withCatalogContext(catalogCtx, () => this.bulkUpload(data));
  }
}
