import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';
import { permissionGuard } from './core/auth/permission-guard';
import { telesalesRouteGuard } from './core/auth/telesales-guard';
import { repartoHomeRouteGuard } from './core/auth/reparto-home-guard';

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
    canActivateChild: [telesalesRouteGuard, repartoHomeRouteGuard],
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
      // Modo televentas (doc 42) — el guard de arriba restringe el resto del
      // panel cuando aplica; esta ruta no repite permiso, el modo ya decide.
      {
        path: 'televentas',
        loadChildren: () =>
          import('./features/televentas/televentas.routes').then((m) => m.TELEVENTAS_ROUTES),
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
        loadComponent: () =>
          import('./features/customer-requests/approvals').then((m) => m.ApprovalsPage),
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
      // Reportes de ventas — nuevo, separa operación (Pedidos) de análisis.
      // `report.view` también entra (doc 50, sección 2): el Jefe de reparto
      // los usa para verificar faltantes y devoluciones, sin ver Pedidos.
      {
        path: 'reportes-ventas',
        canActivate: [permissionGuard('order.view_all', 'report.view')],
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

      // Reparto (módulo 5) — rediseñado. `delivery.manage` (doc 50): Jefe de
      // reparto ve todas las planillas y asigna equipo, sin liquidar.
      {
        path: 'reparto',
        canActivate: [permissionGuard('delivery.deliver', 'delivery.settle', 'delivery.manage')],
        loadChildren: () =>
          import('./features/delivery/delivery.routes').then((m) => m.DELIVERY_ROUTES),
      },
      {
        path: 'flota',
        canActivate: [permissionGuard('delivery.settle', 'delivery.manage')],
        loadChildren: () => import('./features/fleet/fleet.routes').then((m) => m.FLEET_ROUTES),
      },
      // Inicio de reparto (doc 50, sección 5) — home de quien organiza el
      // reparto del día y no vende (sin `order.view_all`).
      {
        path: 'inicio-reparto',
        canActivate: [permissionGuard('delivery.manage')],
        loadComponent: () =>
          import('./features/delivery/delivery-home').then((m) => m.DeliveryHomePage),
      },

      // Facturación (módulo 6) — rediseñado
      {
        path: 'facturas',
        canActivate: [permissionGuard('invoice.reconcile')],
        loadChildren: () =>
          import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
      },
      // Validación y envío de pedidos a facturación — doc 32, nuevo.
      {
        path: 'validacion-facturacion',
        canActivate: [permissionGuard('order.send_to_billing')],
        loadChildren: () =>
          import('./features/billing/billing-validation.routes').then(
            (m) => m.BILLING_VALIDATION_ROUTES,
          ),
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

      // Notificaciones de supervisión — doc 36, nuevo.
      {
        path: 'notificaciones',
        canActivate: [permissionGuard('notification.view_all', 'notification.send')],
        loadChildren: () =>
          import('./features/notifications/notification.routes').then((m) => m.NOTIFICATION_ROUTES),
      },

      // Administración (módulo 7) — rediseñado
      {
        path: 'usuarios',
        canActivate: [permissionGuard('user.manage')],
        loadChildren: () => import('./features/users/user.routes').then((m) => m.USER_ROUTES),
      },
      {
        path: 'empresa',
        canActivate: [permissionGuard('config.edit', 'system.maintenance.manage')],
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
        canActivate: [permissionGuard('report.view', 'config.edit', 'stock.advance')],
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
      },
      // Mantenimiento se mudó a Empresa → Sistema (doc 38, sección 10).
      { path: 'mantenimiento', redirectTo: 'empresa/sistema' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
