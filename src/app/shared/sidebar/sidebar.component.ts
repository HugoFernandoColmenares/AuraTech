import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarService } from '@core/services/Utils/sidebar.service';
import { AuthService } from '@core/services/auth/auth';

interface SidebarMenuItem {
  label: string;
  path: string;
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

  readonly menuItems: SidebarMenuItem[] = [
    { label: 'Dashboard', path: '/layout/home' },
    { label: 'Sales Report', path: '/layout/sales-report' },
    { label: 'Products', path: '/layout/products' },
    { label: 'Profile', path: '/layout/profile' },
    { label: 'About', path: '/layout/about' },
  ];

  logout() {
    this.sidebarService.close();
    this.authService.signOut();
  }
}
