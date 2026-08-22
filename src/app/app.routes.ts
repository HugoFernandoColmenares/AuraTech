import { Routes } from '@angular/router';
import { Auth } from './auth/auth';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { ForgotPassword } from './auth/forgot-password/forgot-password';
import { authGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';
import { permissionGuard } from '@core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'auth',
    component: Auth,
    children: [
      { path: 'login', component: Login },
      { path: 'register', component: Register },
      { path: 'forgot-password', component: ForgotPassword },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  {
    path: 'layout',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'sales-report',
        loadComponent: () => import('./pages/sales-report/sales-report.component').then(m => m.SalesReportComponent)
      },
      {
        path: 'credit-card-report',
        loadComponent: () => import('./pages/credit-card-report/credit-card-report.component').then(m => m.CreditCardReportComponent)
      },
      {
        path: 'products',
        loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent)
      },
      {
        path: 'inventory',
        loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent)
      },
      {
        path: 'reference-sheet',
        loadComponent: () => import('./pages/reference-sheet/reference-sheet.component').then(m => m.ReferenceSheetComponent)
      },
      {
        path: 'about',
        loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent)
      },
      {
        path: 'data-management',
        canActivate: [permissionGuard],
        data: { permission: 'dataManagement' },
        loadComponent: () => import('./pages/data-management/data-management.component').then(m => m.DataManagementComponent)
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./pages/admin-panel/admin-panel.component').then(m => m.AdminPanelComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'auth' // wildcard redirection to home via layout
  }
];
