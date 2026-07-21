import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },

      // ── Próximas features (se agregan al construir cada módulo) ──────────
      // { path: 'clientes',     canActivate: [permissionGuard('customer.view')],    loadChildren: () => import('./features/customers/customers.routes').then(m => m.CUSTOMER_ROUTES) },
      // { path: 'aprobaciones', canActivate: [permissionGuard('customer.approve')], loadComponent: () => import('./features/customers/approvals').then(m => m.ApprovalsPage) },
      // { path: 'pedidos',      canActivate: [permissionGuard('order.view_all','order.create')], loadChildren: ... },
      // { path: 'promos',       canActivate: [permissionGuard('promo.create','promo.approve')], loadChildren: ... },
      // { path: 'reparto',      canActivate: [permissionGuard('delivery.deliver','delivery.settle')], loadChildren: ... },
      // { path: 'facturas',     canActivate: [permissionGuard('invoice.reconcile')], loadChildren: ... },
      // { path: 'precios',      canActivate: [permissionGuard('price.view')], loadComponent: ... },
      // { path: 'inventario',   canActivate: [permissionGuard('report.view')], loadComponent: ... },
      // { path: 'empresa',      canActivate: [permissionGuard('config.edit')], loadChildren: ... },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
