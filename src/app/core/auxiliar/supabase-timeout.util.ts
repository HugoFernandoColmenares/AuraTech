/** Returns true for Postgres statement timeout errors from Supabase/PostgREST. */
export function isSupabaseStatementTimeout(error: {
  message?: string | null;
  code?: string | null;
}): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return (
    error.code === '57014' ||
    message.includes('statement timeout') ||
    message.includes('canceling statement')
  );
}

/** PostgREST 404 when an RPC/function is not deployed on the project. */
export function isSupabaseRpcNotFound(error: {
  message?: string | null;
  code?: string | null;
  status?: number | null;
}): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return (
    error.status === 404 ||
    error.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('function') && message.includes('does not exist')
  );
}
