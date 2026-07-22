import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';

export const DELIVERY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./batches-list').then((m) => m.BatchesListPage) },
  {
    path: 'nueva',
    canActivate: [permissionGuard('delivery.settle')],
    loadComponent: () => import('./batch-create').then((m) => m.BatchArmPage),
  },
  { path: ':id', loadComponent: () => import('./batch-detail').then((m) => m.BatchDetailPage) },
];
