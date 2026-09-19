import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./warehouse-stock').then((m) => m.WarehouseStockPage),
  },
  {
    path: 'ajuste',
    loadComponent: () => import('./stock-adjustment').then((m) => m.StockAdjustmentPage),
  },
  {
    path: 'kardex/:productId',
    loadComponent: () => import('./kardex').then((m) => m.KardexPage),
  },
];
