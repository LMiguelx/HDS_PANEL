import { Routes } from '@angular/router';

export const BILLING_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./invoices-inbox').then((m) => m.InvoicesInboxPage) },
  { path: ':id', loadComponent: () => import('./invoice-detail').then((m) => m.InvoiceDetailPage) },
];
