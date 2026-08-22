import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IBrandDto } from '../../interfaces/IBaseCatalogDto.interface';

@Injectable({ providedIn: 'root' })
export class BrandsApiService extends BaseSupabaseApiService<IBrandDto> {
  protected override tableKey = 'brands' as const;
  protected override orderColumn = 'name';
  protected override useListCache = true;
}
