import { Routes } from '@angular/router';

// El detalle de factura vive en app.routes.ts como /factura/:invoiceId (ruta
// propia, no hija de /facturas) — ver comentario ahí.
export const BILLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./invoice-unmatched').then((m) => m.InvoiceUnmatchedPage),
  },
  {
    path: 'por-cliente',
    loadComponent: () => import('./invoice-by-customer').then((m) => m.InvoiceByCustomerPage),
  },
];
