import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';

/**
 * Mock auth is only for local runs without Supabase env vars.
 * When credentials are configured (e.g. Vercel production), always use Supabase Auth
 * even if the startup health probe failed — otherwise login never hits the network.
 */
export function shouldUseMockAuth(env: EnvConfig, _health: HealthService): boolean {
  return !env.supabaseConfigured;
}

/** True when Supabase Auth is the active transport. */
export function shouldUseSupabaseAuth(env: EnvConfig, _health: HealthService): boolean {
  return env.supabaseConfigured;
}
