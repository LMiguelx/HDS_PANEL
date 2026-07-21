import { Routes } from '@angular/router';

export const CUSTOMER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./customer-list').then((m) => m.CustomerListPage) },
  {
    path: ':id',
    loadComponent: () => import('./customer-detail').then((m) => m.CustomerDetailPage),
  },
];
