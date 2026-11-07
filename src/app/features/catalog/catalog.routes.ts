import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./product-list').then((m) => m.ProductListPage),
  },
  {
    path: 'sin-precio',
    loadComponent: () => import('./product-without-prices').then((m) => m.ProductWithoutPricesPage),
  },
  {
    path: ':productId',
    loadComponent: () => import('./product-detail').then((m) => m.ProductDetailPage),
  },
];
