import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IMapSheetBudgetDto } from '../../interfaces/IMapSheetDto.interface';

@Injectable({
  providedIn: 'root',
})
export class MapSheetBudgetApiService extends BaseSupabaseApiService<IMapSheetBudgetDto> {
  protected override tableKey = 'mapSheetBudgets' as const;
  protected override useListCache = true;
}
