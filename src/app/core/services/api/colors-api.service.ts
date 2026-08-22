import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IColorDto } from '../../interfaces/IBaseCatalogDto.interface';

@Injectable({ providedIn: 'root' })
export class ColorsApiService extends BaseSupabaseApiService<IColorDto> {
  protected override tableKey = 'colorsClothes' as const;
  protected override orderColumn = 'name';
  protected override useListCache = true;
}
