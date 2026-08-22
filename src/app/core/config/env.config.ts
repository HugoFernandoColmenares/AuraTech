import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Runtime configuration from environment (see scripts/generate-env.mjs).
 * Only public keys belong here — never service role or database passwords.
 */
@Injectable({
  providedIn: 'root',
})
export class EnvConfig {
  readonly production = environment.production;
  readonly supabaseUrl = environment.supabaseUrl;
  readonly supabaseAnonKey = environment.supabaseAnonKey;
  readonly debugMode = environment.debugMode;
  readonly demoMode = 'demoMode' in environment ? Boolean(environment.demoMode) : true;

  /** True when Supabase URL and anon key are configured. */
  get supabaseConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey);
  }

  /** Live Supabase is used only when credentials exist and demo mode is off. */
  get supabaseActive(): boolean {
    return this.supabaseConfigured && !this.demoMode;
  }
}
