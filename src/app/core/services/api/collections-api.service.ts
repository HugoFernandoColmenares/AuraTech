import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { ICollectionDto } from '../../interfaces/IBaseCatalogDto.interface';

@Injectable({ providedIn: 'root' })
export class CollectionsApiService extends BaseSupabaseApiService<ICollectionDto> {
  protected override tableKey = 'collectionClothes' as const;
  protected override orderColumn = 'name';
  protected override useListCache = true;
}
