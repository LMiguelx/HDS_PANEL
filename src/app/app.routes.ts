import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { permissionGuard } from './core/auth/permission-guard';

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

      // Clientes (módulo 2)
      {
        path: 'clientes',
        canActivate: [permissionGuard('customer.view')],
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMER_ROUTES),
      },
      {
        path: 'aprobaciones',
        canActivate: [permissionGuard('customer.approve')],
        loadComponent: () => import('./features/customers/approvals').then((m) => m.ApprovalsPage),
      },
      {
        path: 'asignaciones',
        canActivate: [permissionGuard('customer.assign')],
        loadComponent: () =>
          import('./features/customers/assignments').then((m) => m.AssignmentsPage),
      },

      // ── Próximas features ───────────────────────────────────────────────
      // { path: 'segmentos',    canActivate: [permissionGuard('segment.manage')],   loadComponent: ... },
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
