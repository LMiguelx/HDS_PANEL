import { Routes } from '@angular/router';

/**
 * Modo televentas (doc 42). Sin guard de permiso propio: el acceso lo
 * decide `AuthService.isTelesalesMode()` vía `telesalesRouteGuard` en la
 * ruta padre del shell — cualquier vendedor que llegue hasta acá ya tiene
 * `visit.register`/`order.create` por su rol.
 */
export const TELEVENTAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/my-day/my-day').then((m) => m.MyDayPage),
  },
  {
    path: 'nuevo-pedido',
    loadComponent: () =>
      import('./pages/new-call-order/new-call-order').then((m) => m.NewCallOrderPage),
  },
  {
    path: 'mis-pedidos',
    loadComponent: () => import('./pages/my-orders/my-orders').then((m) => m.MyOrdersPage),
  },
  {
    path: 'liquidacion',
    loadComponent: () =>
      import('./pages/daily-settlement/daily-settlement').then((m) => m.DailySettlementPage),
  },
  {
    path: 'stock',
    loadComponent: () => import('./pages/stock/stock').then((m) => m.TelesalesStockPage),
  },
];
