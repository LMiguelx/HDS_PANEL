import { Routes } from '@angular/router';

export const SALES_REPORTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'resumen-dia' },
  {
    path: 'resumen-dia',
    loadComponent: () => import('./daily-summary-tab').then((m) => m.DailySummaryTab),
  },
  {
    path: 'liquidacion-vendedores',
    loadComponent: () =>
      import('./salesperson-settlement-tab').then((m) => m.SalespersonSettlementTab),
  },
  {
    path: 'marcas-productos',
    loadComponent: () => import('./brand-sales-tab').then((m) => m.BrandSalesTab),
  },
  {
    path: 'marcas-productos/producto/:productId',
    loadComponent: () => import('./product-sales-detail').then((m) => m.ProductSalesDetailPage),
  },
  {
    path: 'ventas-con-stock',
    loadComponent: () => import('./sales-stock-tab').then((m) => m.SalesStockTab),
  },
];
