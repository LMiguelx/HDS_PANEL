import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { permissionGuard } from './core/auth/permission-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'splash',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/splash').then((m) => m.SplashPage),
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
      // Mi perfil — autoservicio, cualquier autenticado (no cuelga de /usuarios,
      // que sí requiere user.manage).
      {
        path: 'mi-perfil',
        loadComponent: () => import('./features/users/my-profile').then((m) => m.MyProfilePage),
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
      // Pedidos (módulo 3) — rediseñado
      {
        path: 'pedidos',
        canActivate: [permissionGuard('order.view_all', 'order.create')],
        loadChildren: () => import('./features/orders/order.routes').then((m) => m.ORDER_ROUTES),
      },
      // Reportes de ventas — nuevo, separa operación (Pedidos) de análisis
      {
        path: 'reportes-ventas',
        canActivate: [permissionGuard('order.view_all')],
        loadChildren: () =>
          import('./features/sales-reports/sales-reports.routes').then(
            (m) => m.SALES_REPORTS_ROUTES,
          ),
      },

      // Promociones (módulo 4) — rediseñado
      {
        path: 'promociones',
        canActivate: [permissionGuard('promo.create', 'promo.approve', 'promo.allocate')],
        loadChildren: () => import('./features/promos/promos.routes').then((m) => m.PROMO_ROUTES),
      },
      // Segmentos de clientes — nuevo, se usan para el targeting de promociones
      {
        path: 'segmentos',
        canActivate: [permissionGuard('segment.manage')],
        loadChildren: () =>
          import('./features/segments/segments.routes').then((m) => m.SEGMENT_ROUTES),
      },

      // Reparto (módulo 5) — rediseñado
      {
        path: 'reparto',
        canActivate: [permissionGuard('delivery.deliver', 'delivery.settle')],
        loadChildren: () =>
          import('./features/delivery/delivery.routes').then((m) => m.DELIVERY_ROUTES),
      },
      {
        path: 'flota',
        canActivate: [permissionGuard('delivery.settle')],
        loadChildren: () => import('./features/fleet/fleet.routes').then((m) => m.FLEET_ROUTES),
      },

      // Facturación (módulo 6) — rediseñado
      {
        path: 'facturas',
        canActivate: [permissionGuard('invoice.reconcile')],
        loadChildren: () =>
          import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
      },
      // Detalle de factura — ruta propia (no cuelga de /facturas) porque su
      // permiso es más amplio que el de la bandeja de conciliación: customer.view
      // basta para verla (ej. desde el mapa de una planilla), no solo invoice.reconcile.
      {
        path: 'factura/:invoiceId',
        canActivate: [permissionGuard('customer.view', 'invoice.reconcile')],
        loadComponent: () =>
          import('./features/billing/invoice-detail').then((m) => m.InvoiceDetailPage),
      },

      // Administración (módulo 7) — rediseñado
      {
        path: 'usuarios',
        canActivate: [permissionGuard('user.manage')],
        loadChildren: () => import('./features/users/user.routes').then((m) => m.USER_ROUTES),
      },
      {
        path: 'empresa',
        canActivate: [permissionGuard('config.edit')],
        loadChildren: () =>
          import('./features/company/company.routes').then((m) => m.COMPANY_ROUTES),
      },
      // Catálogo y precios — rediseñado
      {
        path: 'precios',
        canActivate: [permissionGuard('price.view', 'product.edit')],
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
      },
      {
        path: 'inventario',
        canActivate: [permissionGuard('report.view', 'config.edit')],
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
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
