import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';

export const SALES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./orders-list').then((m) => m.OrdersAdminPage) },
  {
    path: 'nuevo',
    canActivate: [permissionGuard('order.create')],
    loadComponent: () => import('./order-create').then((m) => m.OrderCreatePage),
  },
  {
    path: 'bonificaciones-pendientes',
    canActivate: [permissionGuard('order.view_all')],
    loadComponent: () => import('./pending-bonuses').then((m) => m.PendingBonusesPage),
  },
  { path: ':id', loadComponent: () => import('./order-detail').then((m) => m.OrderDetailPage) },
];
