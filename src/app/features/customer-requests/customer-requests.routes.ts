import { Routes } from '@angular/router';

export const CUSTOMER_REQUEST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./request-creation').then((m) => m.RequestCreationPage),
  },
  {
    path: 'cambios',
    loadComponent: () => import('./request-field-change').then((m) => m.RequestFieldChangePage),
  },
  {
    path: 'cierre',
    loadComponent: () => import('./request-closure').then((m) => m.RequestClosurePage),
  },
];
