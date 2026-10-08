import { Routes } from '@angular/router';

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
    loadComponent: () => import('./stock-adjustment').then((m) => m.StockAdjustmentPage),
  },
  {
    path: 'cuadre',
    loadComponent: () => import('./stock-reconciliation').then((m) => m.StockReconciliationPage),
  },
  {
    path: 'cuadre/:uploadId',
    loadComponent: () => import('./stock-reconciliation').then((m) => m.StockReconciliationPage),
  },
  {
    path: 'kardex/:productId',
    loadComponent: () => import('./kardex').then((m) => m.KardexPage),
  },
];
