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
      {
        path: 'segmentos',
        canActivate: [permissionGuard('segments.manage')],
        loadComponent: () => import('./features/segments/segments').then((m) => m.SegmentsPage),
      },

      // Pedidos (módulo 3)
      {
        path: 'pedidos',
        canActivate: [permissionGuard('order.view_all', 'order.create')],
        loadChildren: () => import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES),
      },

      // Promociones (módulo 4)
      {
        path: 'promos',
        canActivate: [permissionGuard('promo.create', 'promo.approve')],
        loadChildren: () => import('./features/promos/promos.routes').then((m) => m.PROMO_ROUTES),
      },
      {
        path: 'dotaciones',
        canActivate: [permissionGuard('promo.allocate')],
        loadComponent: () =>
          import('./features/promos/allocations-admin').then((m) => m.AllocationsAdminPage),
      },

      // Reparto (módulo 5)
      {
        path: 'reparto',
        canActivate: [permissionGuard('delivery.deliver', 'delivery.settle')],
        loadChildren: () =>
          import('./features/delivery/delivery.routes').then((m) => m.DELIVERY_ROUTES),
      },
      {
        path: 'flota',
        canActivate: [permissionGuard('delivery.settle')],
        loadComponent: () => import('./features/delivery/fleet-page').then((m) => m.FleetPage),
      },

      // Facturación (módulo 6)
      {
        path: 'facturas',
        canActivate: [permissionGuard('invoice.reconcile')],
        loadChildren: () =>
          import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
      },

      // Administración (módulo 7)
      {
        path: 'empresa',
        canActivate: [permissionGuard('config.edit')],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'precios',
        canActivate: [permissionGuard('price.view')],
        loadComponent: () => import('./features/admin/prices').then((m) => m.PricesPage),
      },
      {
        path: 'inventario',
        canActivate: [permissionGuard('report.view')],
        loadComponent: () => import('./features/admin/kardex').then((m) => m.KardexPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
