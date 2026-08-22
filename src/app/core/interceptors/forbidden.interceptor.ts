import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AlertService } from '@core/services/Utils/alert.service';
import { ACCESS_DENIED_MESSAGE } from '@core/auxiliar/supabase-error.util';

let lastForbiddenAlertAt = 0;
const FORBIDDEN_ALERT_DEBOUNCE_MS = 2_000;

export const forbiddenInterceptor: HttpInterceptorFn = (req, next) => {
  const alertService = inject(AlertService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        const now = Date.now();
        if (now - lastForbiddenAlertAt > FORBIDDEN_ALERT_DEBOUNCE_MS) {
          lastForbiddenAlertAt = now;
          alertService.error('Access denied', ACCESS_DENIED_MESSAGE);
        }
      }
      return throwError(() => error);
    })
  );
};
