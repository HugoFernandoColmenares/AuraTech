import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IMapSheetDto } from '../../interfaces/IMapSheetDto.interface';

@Injectable({
  providedIn: 'root',
})
export class MapSheetApiService extends BaseSupabaseApiService<IMapSheetDto> {
  protected override tableKey = 'mapSheets' as const;
  protected override useListCache = true;
}
