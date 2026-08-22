import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvConfig } from '@core/config/env.config';

/**
 * Lazy singleton for {@link SupabaseClient}.
 * Only the anon key is used — never the service role in the browser.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly env = inject(EnvConfig);
  private client: SupabaseClient | null = null;

  /** True when URL and anon key are present in environment. */
  isConfigured(): boolean {
    return this.env.supabaseConfigured;
  }

  /** Returns the shared client, or null when Supabase is not configured. */
  getClient(): SupabaseClient | null {
    if (!this.env.supabaseConfigured) {
      return null;
    }

    if (!this.client) {
      this.client = createClient(this.env.supabaseUrl, this.env.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }

    return this.client;
  }
}
