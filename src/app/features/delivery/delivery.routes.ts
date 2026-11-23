import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';
import { pickingDetailCanDeactivate } from './picking-deactivate-guard';

export const DELIVERY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./delivery-batches').then((m) => m.DeliveryBatchesPage),
  },
  // Picking (doc 89) — rutas propias dentro de Reparto, con su propio guard
  // (`picking.view` o `picking.store`): el guard de `/reparto` solo deja
  // pasar a quien tenga alguno de los dos.
  {
    path: 'picking',
    canActivate: [permissionGuard('picking.view', 'picking.store')],
    loadComponent: () => import('./picking-list').then((m) => m.PickingListPage),
  },
  {
    path: 'picking/:batchId',
    canActivate: [permissionGuard('picking.view', 'picking.store')],
    canDeactivate: [pickingDetailCanDeactivate],
    loadComponent: () => import('./picking-detail').then((m) => m.PickingDetailPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./delivery-batch-detail').then((m) => m.DeliveryBatchDetailPage),
  },
];
