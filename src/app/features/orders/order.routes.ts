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
    // order.edit: el vendedor puede editar sus propios pedidos de campo;
    // order.manage: supervisión edita cualquiera, dotación incluida — doc 36, sección 13.4.
    path: 'editar/:orderId',
    canActivate: [permissionGuard('order.manage', 'order.edit')],
    loadComponent: () => import('./counter-order-form').then((m) => m.CounterOrderFormPage),
  },
  {
    path: 'bonificaciones-sin-stock',
    canActivate: [permissionGuard('order.manage')],
    loadComponent: () => import('./pending-bonuses').then((m) => m.PendingBonusesPage),
  },
  {
    path: 'detalle/:orderId',
    loadComponent: () => import('./order-detail').then((m) => m.OrderDetailPage),
  },
];
