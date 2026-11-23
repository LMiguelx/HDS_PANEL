import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/permission-guard';

export const CUSTOMER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./customer-search').then((m) => m.CustomerSearchPage) },
  {
    path: 'nuevo',
    canActivate: [permissionGuard('customer.create')],
    loadComponent: () => import('./new-customer-page').then((m) => m.NewCustomerPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./customer-detail').then((m) => m.CustomerDetailPage),
  },
];
