import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./warehouse-stock').then((m) => m.WarehouseStockPage),
  },
  {
    path: 'adelantos',
    loadComponent: () => import('./stock-advances').then((m) => m.StockAdvancesPage),
  },
  {
    path: 'ajuste',
    // Solo quien administra ajustes de stock — doc 88, sección 7: "Ajuste de
    // stock no aparece" para quien solo tiene `report.view`.
    canActivate: [permissionGuard('config.edit')],
    loadComponent: () => import('./stock-adjustment').then((m) => m.StockAdjustmentPage),
  },
  {
    path: 'cuadre',
    loadComponent: () => import('./stock-reconciliation').then((m) => m.StockReconciliationPage),
  },
  {
    path: 'cuadre/actualizacion',
    loadComponent: () =>
      import('./stock-reconciliation-sync').then((m) => m.StockReconciliationSyncPage),
  },
  {
    path: 'cuadre/producto/:productId',
    loadComponent: () =>
      import('./stock-reconciliation-product-history').then(
        (m) => m.StockReconciliationProductHistoryPage,
      ),
  },
  {
    path: 'cuadre/:uploadId',
    loadComponent: () =>
      import('./stock-reconciliation-detail').then((m) => m.StockReconciliationDetailPage),
  },
  {
    path: 'kardex/:productId',
    loadComponent: () => import('./kardex').then((m) => m.KardexPage),
  },
  {
    path: 'conteo',
    loadComponent: () => import('./stock-count-board').then((m) => m.StockCountBoardPage),
  },
  {
    path: 'conteo/:stockCountId',
    loadComponent: () => import('./stock-count-detail').then((m) => m.StockCountDetailPage),
  },
];
