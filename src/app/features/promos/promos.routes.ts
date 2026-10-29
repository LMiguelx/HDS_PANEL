import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';

export const PROMO_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./promo-list').then((m) => m.PromoListPage) },
  {
    // leer :id (editar) y ?duplicateFrom= (duplicar desde el listado/detalle).
    path: 'nueva',
    canActivate: [permissionGuard('promo.create')],
    loadComponent: () => import('./promo-wizard').then((m) => m.PromoWizardPage),
  },
  {
    path: ':id/editar',
    canActivate: [permissionGuard('promo.create')],
    loadComponent: () => import('./promo-wizard').then((m) => m.PromoWizardPage),
  },
  {
    path: 'pendientes',
    loadComponent: () => import('./promo-pending').then((m) => m.PromoPendingPage),
  },
  {
    path: 'vigentes',
    canActivate: [permissionGuard('order.create', 'promo.create')],
    loadComponent: () => import('./promo-current').then((m) => m.PromoCurrentPage),
  },
  {
    path: 'simular',
    canActivate: [permissionGuard('order.manage')],
    loadComponent: () => import('./simulate-order-page').then((m) => m.SimulateOrderPage),
  },
  {
    path: 'dotaciones',
    canActivate: [permissionGuard('promo.allocate')],
    loadComponent: () => import('./allocations-admin').then((m) => m.AllocationsAdminPage),
  },
  {
    path: 'alcance',
    canActivate: [permissionGuard('promo.create')],
    loadComponent: () => import('./promo-reach-summary').then((m) => m.PromoReachSummaryPage),
  },
  { path: ':id', loadComponent: () => import('./promo-detail').then((m) => m.PromoDetailPage) },
];
