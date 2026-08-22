import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';

/** True when live entity data should come from Supabase PostgREST. */
export function shouldUseSupabaseData(env: EnvConfig, health: HealthService): boolean {
  return env.supabaseActive && !health.useDemoData();
}

/** True when reference/map lookups should use bundled static TS fallbacks. */
export function shouldUseStaticEntityData(env: EnvConfig, health: HealthService): boolean {
  return !shouldUseSupabaseData(env, health);
}
