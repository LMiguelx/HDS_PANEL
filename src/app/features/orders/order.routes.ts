import { Routes } from '@angular/router';

export const ORDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-list').then((m) => m.OrderListPage),
  },
  {
    path: 'bonificaciones-pendientes',
    loadComponent: () => import('./pending-bonuses').then((m) => m.PendingBonusesPage),
  },
  {
    path: 'detalle/:orderId',
    loadComponent: () => import('./order-detail').then((m) => m.OrderDetailPage),
  },
];
