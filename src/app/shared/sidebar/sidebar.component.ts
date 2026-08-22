import { CommonModule } from '@angular/common';
import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarService } from '@core/services/Utils/sidebar.service';
import { AuthService } from '@core/services/auth/auth';
import { RolePermissionService } from '@core/services/auth/role-permission.service';

interface SidebarMenuItem {
  label: string;
  path: string;
  exact?: boolean;
  permission?: 'dataManagement' | 'adminPanel';
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  sidebarService = inject(SidebarService);
  authService = inject(AuthService);
  permissions = inject(RolePermissionService);

  private readonly allMenuItems: SidebarMenuItem[] = [
    { label: 'Dashboard', path: '/layout/home' },
    { label: 'Sales Report', path: '/layout/sales-report' },
    { label: 'Credit Card Report', path: '/layout/credit-card-report' },
    { label: 'Inventory', path: '/layout/inventory' },
    { label: 'Products', path: '/layout/products' },
    { label: 'Reference Sheet', path: '/layout/reference-sheet' },
    { label: 'Data Management', path: '/layout/data-management', permission: 'dataManagement' },
    { label: 'Admin Panel', path: '/layout/admin', permission: 'adminPanel' },
    { label: 'Profile', path: '/layout/profile' },
    { label: 'About', path: '/layout/about' },
  ];

  menuItems = computed(() =>
    this.allMenuItems.filter(item => !item.permission || this.permissions.can(item.permission))
  );

  logout() {
    this.sidebarService.close();
    this.authService.signOut();
  }
}
