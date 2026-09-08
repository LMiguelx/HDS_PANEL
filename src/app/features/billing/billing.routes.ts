import { Routes } from '@angular/router';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./invoice-unmatched').then((m) => m.InvoiceUnmatchedPage),
  },
  {
    path: 'por-cliente',
    loadComponent: () => import('./invoice-by-customer').then((m) => m.InvoiceByCustomerPage),
  },
  {
    path: 'detalle/:invoiceId',
    loadComponent: () => import('./invoice-detail').then((m) => m.InvoiceDetailPage),
  },
];
