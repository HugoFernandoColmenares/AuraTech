import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarService } from '@core/services/Utils/sidebar.service';
import { AuthService } from '@core/services/auth/auth';
import { ProfileService } from '@core/services/auth/profile';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { buildUserInitials } from '@core/auxiliar/avatar-image.util';
import { ThemeService } from '@core/theme/theme.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  sidebarService = inject(SidebarService);
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  readonly rolePermissions = inject(RolePermissionService);
  readonly themeService = inject(ThemeService);

  displayUser = computed(() => this.profileService.profile() ?? this.authService.currentUser());

  headerName = computed(() => {
    const user = this.displayUser();
    if (!user) return 'Guest';
    const full = `${user.firstName} ${user.lastName}`.trim();
    return full || user.userName || user.email.split('@')[0] || 'User';
  });

  headerEmail = computed(() => this.displayUser()?.email ?? '');

  headerRole = computed(() => {
    const roles = this.displayUser()?.roles ?? [];
    return roles[0]?.name ?? this.rolePermissions.primaryRole();
  });

  avatarUrl = computed(() => this.displayUser()?.avatarUrl ?? '');

  avatarInitials = computed(() => buildUserInitials(this.headerName()));
}
