import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IProductTypeDto } from '../../interfaces/IBaseCatalogDto.interface';

@Injectable({ providedIn: 'root' })
export class ProductTypesApiService extends BaseSupabaseApiService<IProductTypeDto> {
  protected override tableKey = 'typeClothes' as const;
  protected override orderColumn = 'name';
  protected override useListCache = true;
}
