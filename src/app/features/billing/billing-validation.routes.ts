import { Routes } from '@angular/router';

export const BILLING_VALIDATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./billing-pending-tab').then((m) => m.BillingPendingTab),
  },
  {
    path: 'enviados',
    loadComponent: () => import('./billing-sent-tab').then((m) => m.BillingSentTab),
  },
];
