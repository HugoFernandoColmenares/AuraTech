import { Injectable } from '@angular/core';
import { BaseSupabaseApiService } from './base-supabase-api.service';
import { IChannelsCardsDto } from '../../interfaces/IMapSheetDto.interface';

@Injectable({
  providedIn: 'root',
})
export class ChannelsCardsApiService extends BaseSupabaseApiService<IChannelsCardsDto> {
  protected override tableKey = 'channelsCards' as const;
  protected override idColumn = 'control';
  protected override useListCache = true;
}
