/**
 * Standardized API response format shared across Supabase PostgREST services.
 */
export interface IApiResponse<T> {
  success?: boolean;
  statusCode?: number;
  message: string;
  data: T;
  meta?: {
    total?: number;
    totalItems?: number;
    page?: number;
    currentPage?: number;
    limit?: number;
    itemsPerPage?: number;
    totalPages?: number;
  };
  timestamp?: string;
}
