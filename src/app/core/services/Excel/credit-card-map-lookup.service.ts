import { Injectable, inject } from '@angular/core';
import { IChannelsCardsDto, IMapSheetBudgetDto, IMapSheetDto } from '@core/interfaces/IMapSheetDto.interface';
import { MapSheetApiService } from '@core/services/api/map-sheet-api.service';
import { MapSheetBudgetApiService } from '@core/services/api/map-sheet-budget-api.service';
import { ChannelsCardsApiService } from '@core/services/api/channels-cards-api.service';
import { HealthService } from '@core/services/bootstrap/health.service';
import { EnvConfig } from '@core/config/env.config';
import { shouldUseStaticEntityData } from '@core/auxiliar/supabase-transport.util';
import { CHANNEL_CARD_REPORT_DATA } from '@core/data/channel-card-report.data';
import { MAP_SHEET_BUDGET_DATA } from '@core/data/map-sheet-budget.data';
import { MAP_SHEET_DATA } from '@core/data/map-sheet.data';

@Injectable({ providedIn: 'root' })
export class CreditCardMapLookupService {
  private mapApi = inject(MapSheetApiService);
  private budgetApi = inject(MapSheetBudgetApiService);
  private channelsApi = inject(ChannelsCardsApiService);
  private health = inject(HealthService);
  private env = inject(EnvConfig);

  private loaded = false;
  private mapByDesc: IMapSheetDto[] = [...MAP_SHEET_DATA].sort(
    (a, b) => b.mainName.length - a.mainName.length
  );
  private budgets: IMapSheetBudgetDto[] = MAP_SHEET_BUDGET_DATA;
  private channels: IChannelsCardsDto[] = CHANNEL_CARD_REPORT_DATA;

  invalidateCache(): void {
    this.loaded = false;
    this.mapByDesc = [...MAP_SHEET_DATA].sort((a, b) => b.mainName.length - a.mainName.length);
    this.budgets = MAP_SHEET_BUDGET_DATA;
    this.channels = CHANNEL_CARD_REPORT_DATA;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    await this.health.whenReady();
    if (shouldUseStaticEntityData(this.env, this.health)) {
      this.loaded = true;
      return;
    }

    try {
      const [maps, budgets, channels] = await Promise.all([
        this.mapApi.fetchAll(),
        this.budgetApi.fetchAll(),
        this.channelsApi.fetchAll(),
      ]);

      if (maps.length) {
        this.mapByDesc = [...maps].sort((a, b) => b.mainName.length - a.mainName.length);
      }
      if (budgets.length) this.budgets = budgets;
      if (channels.length) this.channels = channels;
      this.loaded = true;
    } catch (err: unknown) {
      console.warn('[CreditCardMapLookupService] API fetch failed, using local fallback.', err);
      this.loaded = true;
    }
  }

  matchMapSheet(description: string): IMapSheetDto | undefined {
    const upper = description.toUpperCase();
    return this.mapByDesc.find(m => upper.includes(m.mainName.toUpperCase()));
  }

  matchBudget(description: string): IMapSheetBudgetDto | undefined {
    const upper = description.toUpperCase();
    return this.budgets.find(b => upper.includes(b.mainName.toUpperCase()));
  }

  matchChannel(control: string): IChannelsCardsDto | undefined {
    return this.channels.find(c => c.control === control);
  }
}

