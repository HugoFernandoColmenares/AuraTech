import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IDivisionDto } from '../../interfaces/IBaseCatalogDto.interface';

@Injectable({ providedIn: 'root' })
export class DivisionsApiService extends BaseSupabaseApiService<IDivisionDto> {
  protected override tableKey = 'divisionClothes' as const;
  protected override orderColumn = 'name';
  protected override useListCache = true;
}
