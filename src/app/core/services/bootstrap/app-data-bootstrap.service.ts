import { Injectable, inject } from '@angular/core';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from './health.service';
import {
  shouldUseSupabaseData,
  shouldUseStaticEntityData,
} from '@core/auxiliar/supabase-transport.util';
import { withTimeout } from '@core/auxiliar/promise-timeout.util';
import { CatalogDataService } from '@core/services/catalog/catalog-data.service';
import { ReferenceSheetDataService } from '@core/services/Excel/reference-sheet-data.service';
import { ProductService } from '@core/services/Excel/product.service';
import { ProfileService } from '@core/services/auth/profile';
import { AuthService } from '@core/services/auth/auth';
import { AppBootstrapStateService } from './app-bootstrap-state.service';

/**
 * Warms in-memory caches once per session after the startup Supabase health probe.
 */
@Injectable({ providedIn: 'root' })
export class AppDataBootstrapService {
  private health = inject(HealthService);
  private env = inject(EnvConfig);
  private catalog = inject(CatalogDataService);
  private referenceData = inject(ReferenceSheetDataService);
  private productService = inject(ProductService);
  private profileService = inject(ProfileService);
  private auth = inject(AuthService);
  private bootstrapState = inject(AppBootstrapStateService);

  private readyPromise: Promise<void> | null = null;

  /** @deprecated Use {@link AppBootstrapStateService.isWarming} */
  readonly isWarming = this.bootstrapState.isWarming;

  warmCaches(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.run();
    return this.readyPromise;
  }

  resetCaches(): void {
    this.readyPromise = null;
    this.referenceData.invalidateCache();
    this.productService.invalidateCache();
    this.profileService.invalidateCache();
  }

  private async run(): Promise<void> {
    await this.health.whenReady();
    this.bootstrapState.setWarming(true);

    try {
      const taskTimeoutMs = 45_000;

      if (shouldUseStaticEntityData(this.env, this.health)) {
        await Promise.allSettled([
          withTimeout(this.referenceData.fetchReferenceData(), taskTimeoutMs, 'reference sheet'),
        ]);
        return;
      }

      if (shouldUseSupabaseData(this.env, this.health)) {
        await withTimeout(this.catalog.loadAll(), taskTimeoutMs, 'catalog');
        await withTimeout(this.referenceData.fetchReferenceData(), taskTimeoutMs, 'reference sheet');
        await withTimeout(this.productService.ensureLoaded(), taskTimeoutMs, 'products');

        if (this.auth.isAuthenticated()) {
          const userId = this.auth.currentUser()?.id;
          if (userId) {
            await withTimeout(this.profileService.ensureProfile(userId), taskTimeoutMs, 'profile');
          }
        }
      }
    } finally {
      this.bootstrapState.setWarming(false);
    }
  }
}
