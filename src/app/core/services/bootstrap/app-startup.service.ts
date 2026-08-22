import { Injectable, inject, signal, computed } from '@angular/core';
import { HealthService } from './health.service';
import { AppDataBootstrapService } from './app-data-bootstrap.service';
import { AuthService } from '@core/services/auth/auth';
import { EnvConfig } from '@core/config/env.config';
import { withTimeout } from '@core/auxiliar/promise-timeout.util';

export type AppBootPhase = 'idle' | 'connection' | 'session' | 'data' | 'ready';

/**
 * Orchestrates startup: health probe → auth session, then releases the UI.
 * Cache warm-up runs in the background so the global loader does not block navigation.
 */
@Injectable({ providedIn: 'root' })
export class AppStartupService {
  private readonly health = inject(HealthService);
  private readonly auth = inject(AuthService);
  private readonly bootstrap = inject(AppDataBootstrapService);
  private readonly env = inject(EnvConfig);

  private readonly _phase = signal<AppBootPhase>('idle');
  private readonly _isReady = signal(false);
  private initPromise: Promise<void> | null = null;

  readonly phase = this._phase.asReadonly();
  readonly isReady = this._isReady.asReadonly();

  readonly bootMessage = computed(() => {
    switch (this.phase()) {
      case 'connection':
        return 'Checking server connection…';
      case 'session':
        return 'Restoring your session…';
      case 'data':
        return 'Loading application data…';
      case 'ready':
        return 'Ready';
      default:
        return 'Starting application…';
    }
  });

  initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.run();
    }
    return this.initPromise;
  }

  whenReady(): Promise<void> {
    return this.initialize();
  }

  private async run(): Promise<void> {
    try {
      this._phase.set('connection');
      await this.health.initialize();

      this._phase.set('session');
      await withTimeout(this.auth.whenReady(), 4_000, 'Auth session');

      if (
        this.auth.isAuthenticated() &&
        this.health.useDemoData() &&
        this.env.supabaseConfigured
      ) {
        await withTimeout(
          this.health.recheckConnection(),
          4_000,
          'Supabase recheck',
          false
        );
      }
    } finally {
      this._phase.set('ready');
      this._isReady.set(true);
    }

    void this.bootstrap.warmCaches().catch(err => {
      console.warn('[AppStartup] Background cache warm-up failed:', err);
    });
  }
}
