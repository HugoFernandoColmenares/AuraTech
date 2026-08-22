import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { NormalizedRole } from '@core/constants/roles.const';

export const roleGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const permissions = inject(RolePermissionService);
  const router = inject(Router);

  await authService.whenReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  const allowed = (route.data['roles'] as NormalizedRole[] | undefined) ?? [];
  if (!allowed.length || permissions.hasAnyRole(allowed)) {
    return true;
  }

  return router.createUrlTree(['/layout/sales-report']);
};
