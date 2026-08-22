/** PostgREST / Postgres codes that indicate RLS or permission denial. */
export function isForbiddenSupabaseError(error: {
  code?: string | null;
  message?: string | null;
  status?: number | null;
} | null | undefined): boolean {
  if (!error) return false;

  const message = (error.message ?? '').toLowerCase();

  return (
    error.status === 403 ||
    error.code === '42501' ||
    error.code === 'PGRST301' ||
    message.includes('permission denied') ||
    message.includes('forbidden') ||
    message.includes('row-level security')
  );
}

export const ACCESS_DENIED_MESSAGE =
  'You do not have permission to perform this action. Contact an administrator if you need access.';
