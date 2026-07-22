import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';

export const PROMO_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./promo-list').then((m) => m.PromoListPage) },
  {
    path: 'nueva',
    canActivate: [permissionGuard('promo.create')],
    loadComponent: () => import('./promo-wizard').then((m) => m.PromoWizardPage),
  },
  { path: ':id', loadComponent: () => import('./promo-detail').then((m) => m.PromoDetailPage) },
];
