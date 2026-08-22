import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@core/services/auth/auth';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenReady();

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
