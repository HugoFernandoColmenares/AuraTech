import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth/auth';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AppPermission } from '@core/constants';

export const permissionGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const permissions = inject(RolePermissionService);
  const router = inject(Router);

  await authService.whenReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  const required = route.data['permission'] as AppPermission | undefined;
  if (!required || permissions.can(required)) {
    return true;
  }

  return router.createUrlTree(['/layout/sales-report']);
};
