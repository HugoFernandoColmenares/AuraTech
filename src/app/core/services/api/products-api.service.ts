import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IProductDto } from '../../interfaces/IProductDto.interface';
import { LocalStorageEntityStore } from '@core/data/local-storage-entity.store';

@Injectable({ providedIn: 'root' })
export class ProductsApiService extends BaseSupabaseApiService<IProductDto> {
  protected override tableKey = 'products' as const;
  protected override useListCache = true;
  protected override orderColumn = 'parent';

  async updateByParent(parent: string, data: Partial<IProductDto>): Promise<void> {
    await this.health.whenReady();
    if (!this.useSupabaseTransport()) {
      const rows = LocalStorageEntityStore.load<IProductDto>('products').map(row =>
        row.parent === parent ? { ...row, ...data, parent } : row
      );
      LocalStorageEntityStore.save('products', rows);
      this.invalidateListCache();
      return;
    }

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
}
