import { Routes } from '@angular/router';

export const DELIVERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./delivery-batches').then((m) => m.DeliveryBatchesPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./delivery-batch-detail').then((m) => m.DeliveryBatchDetailPage),
  },
];
