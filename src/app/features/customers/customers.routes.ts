import { Routes } from '@angular/router';

export const CUSTOMER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./customer-search').then((m) => m.CustomerSearchPage) },
  {
    path: ':id',
    loadComponent: () => import('./customer-detail').then((m) => m.CustomerDetailPage),
  },
];
