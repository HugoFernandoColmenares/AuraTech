import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IFitDto } from '../../interfaces/IBaseCatalogDto.interface';

@Injectable({ providedIn: 'root' })
export class FitsApiService extends BaseSupabaseApiService<IFitDto> {
  protected override tableKey = 'fitClothes' as const;
  protected override orderColumn = 'name';
  protected override useListCache = true;
}
