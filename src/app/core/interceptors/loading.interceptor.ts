import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/Utils/loading.service';

/**
 * Global Loading Interceptor
 * 
 * Added in May 2026:
 * This functional interceptor handles the global loading state for all HTTP requests 
 * following Angular 17+ best practices. It automatically shows a loading indicator 
 * before a request begins and hides it when the response is finalized (success or error).
 * Components have also been refactored to use the centralized LoadingService instead 
 * of managing local loading states.
 */
/** Requests that should not trigger the global loading overlay. */
const SKIP_LOADING_URL_PARTS = ['/health'];

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  if (SKIP_LOADING_URL_PARTS.some(part => req.url.includes(part))) {
    return next(req);
  }

  loadingService.show();

  return next(req).pipe(
    finalize(() => loadingService.hide())
  );
};
