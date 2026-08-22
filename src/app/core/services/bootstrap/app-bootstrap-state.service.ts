import { Injectable, signal } from '@angular/core';

/**
 * Lightweight bootstrap flags — kept separate from {@link AppDataBootstrapService}
 * to avoid circular imports with catalog API services extending BaseSupabaseApiService.
 */
@Injectable({ providedIn: 'root' })
export class AppBootstrapStateService {
  private readonly _isWarming = signal(false);

  /** True while background catalog/reference caches load at startup. */
  readonly isWarming = this._isWarming.asReadonly();

  setWarming(value: boolean): void {
    this._isWarming.set(value);
  }
}
