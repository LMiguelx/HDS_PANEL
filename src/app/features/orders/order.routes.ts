import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';

export const ORDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./order-list').then((m) => m.OrderListPage),
  },
  {
    path: 'nuevo',
    canActivate: [permissionGuard('order.manage')],
    loadComponent: () => import('./counter-order-form').then((m) => m.CounterOrderFormPage),
  },
  {
    path: 'editar/:orderId',
    canActivate: [permissionGuard('order.manage')],
    loadComponent: () => import('./counter-order-form').then((m) => m.CounterOrderFormPage),
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
