import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { permissionGuard } from './core/auth/permission-guard';

const comingSoon = () =>
  import('./shared/ui/coming-soon/coming-soon').then((m) => m.ComingSoonPage);

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

      // Clientes (módulo 2) — rediseñado
      {
        path: 'clientes',
        canActivate: [permissionGuard('customer.view')],
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMER_ROUTES),
      },
      {
        path: 'aprobaciones',
        canActivate: [permissionGuard('customer.approve')],
        loadChildren: () =>
          import('./features/customer-requests/customer-requests.routes').then(
            (m) => m.CUSTOMER_REQUEST_ROUTES,
          ),
      },
      // Asignaciones (módulo 2) — rediseñado
      {
        path: 'asignaciones',
        canActivate: [permissionGuard('customer.assign')],
        loadChildren: () =>
          import('./features/assignments/assignments.routes').then((m) => m.ASSIGNMENT_ROUTES),
      },
      {
        path: 'segmentos',
        canActivate: [permissionGuard('segments.manage')],
        loadComponent: comingSoon,
        data: { title: 'Segmentos', icon: 'group_work' },
      },

      // Pedidos (módulo 3) — sin rediseñar todavía, ver _archive/sales/
      {
        path: 'pedidos',
        canActivate: [permissionGuard('order.view_all', 'order.create')],
        loadComponent: comingSoon,
        data: { title: 'Pedidos', icon: 'receipt' },
      },
      {
        path: 'pedidos/bonificaciones-pendientes',
        canActivate: [permissionGuard('order.view_all')],
        loadComponent: comingSoon,
        data: { title: 'Bonificaciones pendientes', icon: 'production_quantity_limits' },
      },

      // Promociones (módulo 4) — rediseñado
      {
        path: 'promociones',
        canActivate: [permissionGuard('promo.create', 'promo.approve', 'promo.allocate')],
        loadChildren: () => import('./features/promos/promos.routes').then((m) => m.PROMO_ROUTES),
      },

      // Reparto (módulo 5) — sin rediseñar todavía, ver _archive/delivery/
      {
        path: 'reparto',
        canActivate: [permissionGuard('delivery.deliver', 'delivery.settle')],
        loadComponent: comingSoon,
        data: { title: 'Reparto', icon: 'local_shipping' },
      },
      {
        path: 'flota',
        canActivate: [permissionGuard('delivery.settle')],
        loadComponent: comingSoon,
        data: { title: 'Flota', icon: 'directions_car' },
      },

      // Facturación (módulo 6) — sin rediseñar todavía, ver _archive/billing/
      {
        path: 'facturas',
        canActivate: [permissionGuard('invoice.reconcile')],
        loadComponent: comingSoon,
        data: { title: 'Facturas', icon: 'description' },
      },

      // Administración (módulo 7) — sin rediseñar todavía, ver _archive/admin/
      {
        path: 'empresa',
        canActivate: [permissionGuard('config.edit')],
        loadComponent: comingSoon,
        data: { title: 'Empresa', icon: 'business' },
      },
      {
        path: 'precios',
        canActivate: [permissionGuard('price.view')],
        loadComponent: comingSoon,
        data: { title: 'Precios', icon: 'sell' },
      },
      {
        path: 'inventario',
        canActivate: [permissionGuard('report.view')],
        loadComponent: comingSoon,
        data: { title: 'Inventario', icon: 'inventory' },
      },
      // Mantenimiento — rediseñado
      {
        path: 'mantenimiento',
        canActivate: [permissionGuard('config.edit')],
        loadComponent: () =>
          import('./features/maintenance/maintenance-page').then((m) => m.MaintenancePage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
