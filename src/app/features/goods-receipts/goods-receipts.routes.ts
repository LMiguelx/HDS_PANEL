import { Routes } from '@angular/router';
import { GoodsReceiptsLayout } from './pages/goods-receipts.layout';

/**
 * Recepción de mercadería — doc 58, sección 1. Las pestañas (Layout) solo
 * envuelven los dos listados; el detalle de una entrega y la página de una
 * marca son pantallas propias, sin pestañas (igual que Cuadre con el ERP,
 * doc 56).
 */
export const GOODS_RECEIPTS_ROUTES: Routes = [
  {
    path: '',
    component: GoodsReceiptsLayout,
    children: [
      { path: '', redirectTo: 'entregas', pathMatch: 'full' },
      {
        path: 'entregas',
        loadComponent: () =>
          import('./pages/receipt-list/receipt-list').then((m) => m.ReceiptListPage),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./pages/brand-config-list/brand-config-list').then((m) => m.BrandConfigListPage),
      },
    ],
  },
  {
    path: 'entregas/:receiptId',
    loadComponent: () =>
      import('./pages/receipt-detail/receipt-detail').then((m) => m.ReceiptDetailPage),
  },
  {
    path: 'configuracion/:brandId',
    loadComponent: () => import('./pages/brand-config/brand-config').then((m) => m.BrandConfigPage),
  },
];
