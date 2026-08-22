/** Production role UUIDs validated in Supabase. */
export const ROLE_IDS = {
  USER: 'a64a29b9-7116-414d-b4ba-1d9a319fc8ac',
  MANAGER: 'ab138b16-1fe9-4048-b93e-bad7a3c9db02',
  ADMIN: 'bf4cff70-4f9b-47d0-957a-6e0c860b9969',
} as const;

export type RoleKey = keyof typeof ROLE_IDS;

/** Normalized role names as stored in `roles.normalized_name`. */
export const ROLE_NORMALIZED = {
  USER: 'USER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

export type NormalizedRole = (typeof ROLE_NORMALIZED)[keyof typeof ROLE_NORMALIZED];

/** Maps legacy / mock aliases to canonical normalized names. */
export const ROLE_ALIASES: Record<string, NormalizedRole> = {
  USER: ROLE_NORMALIZED.USER,
  MANAGER: ROLE_NORMALIZED.MANAGER,
  ADMIN: ROLE_NORMALIZED.ADMIN,
  ADMINISTRATOR: ROLE_NORMALIZED.ADMIN,
};
