import { Injectable, inject, signal, computed } from '@angular/core';
import { EnvConfig } from '@core/config/env.config';

const HEALTH_SESSION_KEY = 'ymi_supabase_health';
const HEALTH_PROBE_TIMEOUT_MS = 2_500;
const HEALTH_PROBE_RETRIES = 1;

/**
 * Probes Supabase once per browser session at app startup.
 * {@link useDemoData} stays stable until {@link recheckConnection} is called manually.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private env = inject(EnvConfig);

  private _isHealthy = signal(false);
  private _isReady = signal(false);
  private _isChecking = signal(false);
  private initPromise: Promise<boolean> | null = null;

  readonly isHealthy = this._isHealthy.asReadonly();
  readonly isReady = this._isReady.asReadonly();
  readonly isChecking = this._isChecking.asReadonly();
  readonly useDemoData = computed(() => !this._isHealthy());

  initialize(): Promise<boolean> {
    if (!this.initPromise) {
      this.initPromise = this.runStartupProbe();
    }
    return this.initPromise;
  }

  whenReady(): Promise<boolean> {
    return this.initialize();
  }

  async recheckConnection(): Promise<boolean> {
    this._isChecking.set(true);
    try {
      sessionStorage.removeItem(HEALTH_SESSION_KEY);
      const ok = await this.probeSupabase();
      this.writeSessionCache(ok);
      return ok;
    } finally {
      this._isChecking.set(false);
      this._isReady.set(true);
    }
  }

  private async runStartupProbe(): Promise<boolean> {
    if (!this.env.supabaseConfigured) {
      this._isHealthy.set(false);
      this._isReady.set(true);
      this.writeSessionCache(false);
      return false;
    }

    const cached = this.readSessionCache();
    if (cached !== null) {
      this._isHealthy.set(cached);
      this._isReady.set(true);
      return cached;
    }

    const ok = await this.probeSupabaseWithRetry();
    this.writeSessionCache(ok);
    this._isReady.set(true);
    return ok;
  }

  private async probeSupabaseWithRetry(): Promise<boolean> {
    for (let attempt = 0; attempt < HEALTH_PROBE_RETRIES; attempt++) {
      const ok = await this.probeSupabase();
      if (ok) return true;
      if (attempt < HEALTH_PROBE_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    return false;
  }

  private async probeSupabase(): Promise<boolean> {
    if (!this.env.supabaseConfigured) {
      this._isHealthy.set(false);
      return false;
    }

    const baseUrl = this.env.supabaseUrl.replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_PROBE_TIMEOUT_MS);

    try {
      const res = await fetch(`${baseUrl}/auth/v1/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          apikey: this.env.supabaseAnonKey,
        },
        signal: controller.signal,
      });

      const ok = res.ok;
      this._isHealthy.set(ok);
      return ok;
    } catch {
      this._isHealthy.set(false);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private readSessionCache(): boolean | null {
    const raw = sessionStorage.getItem(HEALTH_SESSION_KEY);
    if (raw === 'online') return true;
    if (raw === 'offline') return false;
    return null;
  }

  private writeSessionCache(healthy: boolean): void {
    sessionStorage.setItem(HEALTH_SESSION_KEY, healthy ? 'online' : 'offline');
  }
}
