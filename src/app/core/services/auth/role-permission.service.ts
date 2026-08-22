import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth';
import { IRoleDto } from '@core/interfaces/user.interface';
import {
  AppPermission,
  PERMISSIONS_BY_ROLE,
  PERMISSION_LABELS,
  ROLE_CAPABILITY_SUMMARY,
  ROLE_HIERARCHY,
} from '@core/constants/permissions.const';
import {
  NormalizedRole,
  ROLE_ALIASES,
  ROLE_IDS,
  RoleKey,
} from '@core/constants/roles.const';

@Injectable({ providedIn: 'root' })
export class RolePermissionService {
  private readonly auth = inject(AuthService);

  readonly primaryRole = computed(() => this.resolvePrimaryRole(this.auth.currentUser()?.roles ?? []));

  readonly permissions = computed(() => {
    const role = this.primaryRole();
    return role ? PERMISSIONS_BY_ROLE[role] : PERMISSIONS_BY_ROLE.USER;
  });

  readonly isAdmin = computed(() => this.primaryRole() === 'ADMIN');
  readonly isManager = computed(() => this.primaryRole() === 'MANAGER');
  readonly isUser = computed(() => this.primaryRole() === 'USER');

  readonly canCreate = computed(() => this.can('create'));
  readonly canEdit = computed(() => this.can('edit'));
  readonly canDelete = computed(() => this.can('delete'));
  readonly canBulkUpload = computed(() => this.can('bulkUpload'));
  readonly canAccessDataManagement = computed(() => this.can('dataManagement'));
  readonly canAccessAdminPanel = computed(() => this.can('adminPanel'));

  readonly roleCapabilitySummary = computed(() => {
    const role = this.primaryRole();
    return ROLE_CAPABILITY_SUMMARY[role] ?? ROLE_CAPABILITY_SUMMARY.USER;
  });

  readonly grantedPermissionLabels = computed(() =>
    [...this.permissions()].map(permission => PERMISSION_LABELS[permission])
  );

  can(permission: AppPermission): boolean {
    return this.permissions().has(permission);
  }

  hasRole(role: RoleKey | NormalizedRole): boolean {
    const normalized = typeof role === 'string' && role in ROLE_IDS
      ? this.roleKeyToNormalized(role as RoleKey)
      : this.normalizeRoleName(role as string);
    return this.primaryRole() === normalized;
  }

  hasAnyRole(roles: (RoleKey | NormalizedRole)[]): boolean {
    return roles.some(role => this.hasRole(role));
  }

  normalizeRoleName(value: string): NormalizedRole | null {
    const key = value.trim().toUpperCase();
    return ROLE_ALIASES[key] ?? null;
  }

  private roleKeyToNormalized(role: RoleKey): NormalizedRole {
    switch (role) {
      case 'ADMIN':
        return 'ADMIN';
      case 'MANAGER':
        return 'MANAGER';
      default:
        return 'USER';
    }
  }

  private resolvePrimaryRole(roles: IRoleDto[]): NormalizedRole {
    const normalized = roles
      .map(r => this.normalizeRoleName(r.normalizedName) ?? this.normalizeRoleName(r.name))
      .filter((r): r is NormalizedRole => r !== null);

    if (!normalized.length) {
      return 'USER';
    }

    let highest: NormalizedRole = 'USER';
    let highestIndex = -1;

    for (const role of normalized) {
      const index = ROLE_HIERARCHY.indexOf(role);
      if (index > highestIndex) {
        highestIndex = index;
        highest = role;
      }
    }

    return highest;
  }
}
