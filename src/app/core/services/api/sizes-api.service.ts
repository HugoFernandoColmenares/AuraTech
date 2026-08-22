import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { ISizeDto } from '../../interfaces/IBaseCatalogDto.interface';

@Injectable({ providedIn: 'root' })
export class SizesApiService extends BaseSupabaseApiService<ISizeDto> {
  protected override tableKey = 'sizeClothes' as const;
  protected override orderColumn = 'name';
  protected override useListCache = true;
}
