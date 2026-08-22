import { Injectable, inject, signal, computed } from '@angular/core';
import { IReferenceSheetDto } from '@core/interfaces/IReferenceSheetDto.interface';
import { ReferenceSheetApiService } from '@core/services/api/reference-sheet-api.service';
import { referenceSheetData } from '@core/data/reference-sheet-data';
import { generateGuid } from '@core/auxiliar/guid-utils';
import { FallbackDataLoader } from '@core/services/bootstrap/fallback-data.loader';
import { HealthService } from '@core/services/bootstrap/health.service';
import { EnvConfig } from '@core/config/env.config';
import { shouldUseStaticEntityData } from '@core/auxiliar/supabase-transport.util';

@Injectable({ providedIn: 'root' })
export class ReferenceSheetDataService {
  private api = inject(ReferenceSheetApiService);
  private fallbackLoader = inject(FallbackDataLoader);
  private health = inject(HealthService);
  private env = inject(EnvConfig);
  private _referenceData = signal<IReferenceSheetDto[]>([]);
  private loadPromise: Promise<IReferenceSheetDto[]> | null = null;

  /** True when in-memory rows are available for immediate render. */
  readonly isHydrated = computed(() => this._referenceData().length > 0);

  invalidateCache(): void {
    this.loadPromise = null;
    this._referenceData.set([]);
  }

  public async fetchReferenceData(options?: { force?: boolean }): Promise<IReferenceSheetDto[]> {
    if (!options?.force && this._referenceData().length > 0) {
      return this._referenceData();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.loadOnce(options?.force === true);
    try {
      return await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async loadOnce(force: boolean): Promise<IReferenceSheetDto[]> {
    await this.health.whenReady();

    if (!force && this.api.isListCacheReady()) {
      const cached = this.mapRows(this.api.cachedItems());
      this._referenceData.set(cached);
      return cached;
    }

    if (shouldUseStaticEntityData(this.env, this.health)) {
      const rows = this.mapRows(referenceSheetData);
      this._referenceData.set(rows);
      return rows;
    }

    const rows = await this.fallbackLoader.load({
      fetchLive: async () => {
        if (force) {
          this.api.invalidateListCache();
        }
        await this.api.ensureListCache();
        return this.mapRows(this.api.cachedItems());
      },
      fallback: this.mapRows(referenceSheetData),
      onLoaded: data => this._referenceData.set(data),
    });

    return rows;
  }

  private mapRows(rows: IReferenceSheetDto[]): IReferenceSheetDto[] {
    return rows
      .filter(item => item.brand !== 'Redo')
      .map(item => ({ ...item, id: item.id ?? generateGuid(), isLocal: false }));
  }

  public getReferenceData() {
    return this._referenceData;
  }

  isLoaded(): boolean {
    return this._referenceData().length > 0;
  }

  async reloadFromApi(): Promise<IReferenceSheetDto[]> {
    this.api.invalidateListCache();
    this.invalidateCache();
    return this.fetchReferenceData({ force: true });
  }
}
